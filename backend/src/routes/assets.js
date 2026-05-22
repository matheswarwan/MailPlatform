import { randomUUID } from 'crypto';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { query } from '../config/database.js';
import { s3Client } from '../config/aws.js';
import { authenticate } from '../middleware/auth.js';

const BUCKET = process.env.S3_BUCKET;
const REGION = process.env.AWS_REGION || 'us-east-2';

function getMimeType(mimetype) {
  if (!mimetype) return 'other';
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype === 'text/html') return 'html';
  return 'other';
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export default async function assetRoutes(fastify) {
  // GET /api/assets — list assets, optional ?type=image|pdf|html|other
  fastify.get('/api/assets', { preHandler: authenticate }, async (request, reply) => {
    const accountId = request.user.accountId;
    const { type } = request.query;

    try {
      let sql = `
        SELECT id, account_id, name, type, mime_type, s3_key, url, size_bytes, created_at
        FROM assets
        WHERE account_id = $1
      `;
      const params = [accountId];

      if (type) {
        sql += ' AND type = $2';
        params.push(type);
      }

      sql += ' ORDER BY created_at DESC';

      const result = await query(sql, params);
      return reply.send({ assets: result.rows });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to fetch assets');
      return reply.code(500).send({ error: 'Failed to fetch assets', detail: err.message });
    }
  });

  // POST /api/assets/upload — multipart upload to S3
  fastify.post('/api/assets/upload', { preHandler: authenticate }, async (request, reply) => {
    const accountId = request.user.accountId;

    try {
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      const chunks = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      if (!BUCKET) {
        return reply.code(500).send({ error: 'S3_BUCKET environment variable not configured' });
      }

      const originalName = data.filename || 'upload';
      const sanitized = sanitizeFilename(originalName);
      const key = `assets/${accountId}/${randomUUID()}-${sanitized}`;
      const mimetype = data.mimetype || 'application/octet-stream';
      const assetType = getMimeType(mimetype);
      const url = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: buffer,
          ContentType: mimetype,
          // For public-read access; adjust if bucket policy handles this
          ACL: 'public-read',
        })
      );

      const result = await query(
        `INSERT INTO assets (account_id, name, type, mime_type, s3_key, url, size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [accountId, originalName, assetType, mimetype, key, url, buffer.length]
      );

      return reply.code(201).send({ asset: result.rows[0] });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to upload asset');
      return reply.code(500).send({ error: 'Failed to upload asset', detail: err.message, stack: err.stack });
    }
  });

  // DELETE /api/assets/:id — delete from S3 and DB
  fastify.delete('/api/assets/:id', { preHandler: authenticate }, async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params;

    try {
      const existing = await query(
        'SELECT * FROM assets WHERE id = $1 AND account_id = $2',
        [id, accountId]
      );

      if (existing.rows.length === 0) {
        return reply.code(404).send({ error: 'Asset not found' });
      }

      const asset = existing.rows[0];

      // Delete from S3
      if (BUCKET && asset.s3_key) {
        try {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: BUCKET,
              Key: asset.s3_key,
            })
          );
        } catch (s3Err) {
          fastify.log.warn({ err: s3Err }, 'S3 delete failed — continuing with DB delete');
        }
      }

      await query('DELETE FROM assets WHERE id = $1 AND account_id = $2', [id, accountId]);

      return reply.send({ success: true });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to delete asset');
      return reply.code(500).send({ error: 'Failed to delete asset', detail: err.message, stack: err.stack });
    }
  });
}
