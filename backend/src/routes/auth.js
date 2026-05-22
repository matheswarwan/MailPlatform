import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

export default async function authRoutes(fastify) {
  // POST /api/auth/register
  fastify.post('/api/auth/register', async (request, reply) => {
    const { email, password, name, company } = request.body || {};

    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required' });
    }

    if (password.length < 8) {
      return reply.code(400).send({ error: 'Password must be at least 8 characters' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return reply.code(400).send({ error: 'Invalid email address' });
    }

    try {
      // Check if account already exists
      const existing = await query('SELECT id FROM accounts WHERE email = $1', [email.toLowerCase()]);
      if (existing.rows.length > 0) {
        return reply.code(409).send({ error: 'An account with this email already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const result = await query(
        `INSERT INTO accounts (email, password_hash, name, company)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, name, company, created_at`,
        [email.toLowerCase(), passwordHash, name || null, company || null]
      );

      const account = result.rows[0];

      const token = jwt.sign(
        { accountId: account.id, email: account.email, name: account.name },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return reply.code(201).send({
        token,
        account: {
          id: account.id,
          email: account.email,
          name: account.name,
          company: account.company,
          createdAt: account.created_at,
        },
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/auth/login
  fastify.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body || {};

    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required' });
    }

    try {
      const result = await query(
        'SELECT id, email, password_hash, name, company FROM accounts WHERE email = $1',
        [email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        return reply.code(401).send({ error: 'Invalid email or password' });
      }

      const account = result.rows[0];
      const passwordMatch = await bcrypt.compare(password, account.password_hash);

      if (!passwordMatch) {
        return reply.code(401).send({ error: 'Invalid email or password' });
      }

      const token = jwt.sign(
        { accountId: account.id, email: account.email, name: account.name },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return reply.code(200).send({
        token,
        account: {
          id: account.id,
          email: account.email,
          name: account.name,
          company: account.company,
        },
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/auth/me
  fastify.get('/api/auth/me', { preHandler: authenticate }, async (request, reply) => {
    try {
      const result = await query(
        `SELECT id, email, name, company, physical_address, from_name, from_email,
                ses_verified_domain, created_at, updated_at
         FROM accounts
         WHERE id = $1`,
        [request.user.accountId]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Account not found' });
      }

      const account = result.rows[0];

      return reply.code(200).send({
        account: {
          id: account.id,
          email: account.email,
          name: account.name,
          company: account.company,
          physicalAddress: account.physical_address,
          fromName: account.from_name,
          fromEmail: account.from_email,
          sesVerifiedDomain: account.ses_verified_domain,
          createdAt: account.created_at,
          updatedAt: account.updated_at,
        },
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /api/auth/me - update account profile
  fastify.put('/api/auth/me', { preHandler: authenticate }, async (request, reply) => {
    const { name, company, physicalAddress, fromName, fromEmail } = request.body || {};

    try {
      const result = await query(
        `UPDATE accounts
         SET name = COALESCE($1, name),
             company = COALESCE($2, company),
             physical_address = COALESCE($3, physical_address),
             from_name = COALESCE($4, from_name),
             from_email = COALESCE($5, from_email),
             updated_at = NOW()
         WHERE id = $6
         RETURNING id, email, name, company, physical_address, from_name, from_email, updated_at`,
        [name, company, physicalAddress, fromName, fromEmail, request.user.accountId]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Account not found' });
      }

      const account = result.rows[0];

      return reply.code(200).send({
        account: {
          id: account.id,
          email: account.email,
          name: account.name,
          company: account.company,
          physicalAddress: account.physical_address,
          fromName: account.from_name,
          fromEmail: account.from_email,
          updatedAt: account.updated_at,
        },
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
