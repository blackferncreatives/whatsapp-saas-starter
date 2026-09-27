const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  // Fail loudly at startup rather than silently signing tokens with
  // `undefined`, which would make them trivially forgeable.
  console.warn('WARNING: JWT_SECRET is not set. Set it in your .env before going to production.');
}

async function hashPassword(plainPassword) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plainPassword, salt);
}

async function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

function issueToken({ userId, tenantId, role }) {
  return jwt.sign({ sub: userId, tenantId, role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

function verifyToken(token) {
  // Throws if invalid/expired — callers should catch this.
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { hashPassword, verifyPassword, issueToken, verifyToken };
