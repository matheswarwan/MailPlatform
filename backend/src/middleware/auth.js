import jwt from 'jsonwebtoken';

export async function authenticate(request, reply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    request.user = decoded;
  } catch {
    return reply.code(401).send({ error: 'Invalid token' });
  }
}
