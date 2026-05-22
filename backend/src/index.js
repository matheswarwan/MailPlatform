import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { runMigrations } from './config/database.js';
import authRoutes from './routes/auth.js';
import contactRoutes from './routes/contacts.js';
import campaignRoutes from './routes/campaigns.js';
import segmentRoutes from './routes/segments.js';
import automationRoutes from './routes/automations.js';
import analyticsRoutes from './routes/analytics.js';
import preferenceRoutes from './routes/preferences.js';
import webhookRoutes from './routes/webhooks.js';
import contactAttributeRoutes from './routes/contact-attributes.js';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    transport:
      process.env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
          }
        : undefined,
  },
  trustProxy: true, // Required for req.ip behind ALB / reverse proxy
});

// ── CORS ───────────────────────────────────────────────────────────────────────
await app.register(cors, {
  origin: process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((u) => u.trim())
    : 'http://localhost:3000',
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
});

// ── Helmet (security headers) ─────────────────────────────────────────────────
await app.register(helmet, {
  contentSecurityPolicy: false, // Disable CSP — managed by frontend
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

// ── Multipart (file uploads) ──────────────────────────────────────────────────
await app.register(multipart, {
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB max file size
    files: 1,                    // Only 1 file per request
    fieldSize: 1024 * 1024,      // 1 MB max field size
  },
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.setErrorHandler((error, request, reply) => {
  app.log.error({ err: error, url: request.url, method: request.method }, 'Request error');

  if (error.statusCode) {
    return reply.code(error.statusCode).send({ error: error.message });
  }

  if (error.validation) {
    return reply.code(400).send({
      error: 'Validation error',
      details: error.validation,
    });
  }

  return reply.code(500).send({ error: 'Internal server error' });
});

// ── Not-found handler ─────────────────────────────────────────────────────────
app.setNotFoundHandler((request, reply) => {
  reply.code(404).send({ error: `Route ${request.method} ${request.url} not found` });
});

// ── Database migrations ───────────────────────────────────────────────────────
try {
  await runMigrations();
} catch (err) {
  app.log.error({ err }, 'Database migration failed');
  process.exit(1);
}

// ── Route registration ────────────────────────────────────────────────────────
await app.register(authRoutes);
await app.register(contactRoutes);
await app.register(campaignRoutes);
await app.register(segmentRoutes);
await app.register(automationRoutes);
await app.register(analyticsRoutes);
await app.register(preferenceRoutes);
await app.register(webhookRoutes);
await app.register(contactAttributeRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', {
  schema: {
    response: {
      200: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          uptime: { type: 'number' },
          timestamp: { type: 'string' },
          version: { type: 'string' },
        },
      },
    },
  },
}, async () => ({
  status: 'ok',
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
  version: process.env.npm_package_version || '1.0.0',
}));

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async (signal) => {
  app.log.info(`Received ${signal} — shutting down gracefully`);
  try {
    await app.close();
    app.log.info('Server closed');
    process.exit(0);
  } catch (err) {
    app.log.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ── Start server ──────────────────────────────────────────────────────────────
const port = parseInt(process.env.PORT || '3001');
const host = process.env.HOST || '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`MailFlow backend running on http://${host}:${port}`);
} catch (err) {
  app.log.error({ err }, 'Failed to start server');
  process.exit(1);
}
