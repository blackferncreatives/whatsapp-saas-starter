const express = require('express');
const { hashPassword, verifyPassword, issueToken } = require('../services/auth');
const { createTenantWithOwner, findUserByEmail } = require('../db/queries');

const router = express.Router();

/**
 * Creates a new tenant (your customer's company/workspace) plus its
 * first user (the owner). Everything else in the app is scoped to
 * this tenant_id from here on.
 */
router.post('/auth/signup', async (req, res) => {
  const { tenantName, email, password } = req.body;

  if (!tenantName || !email || !password) {
    return res.status(400).json({ error: 'tenantName, email, and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }

    const passwordHash = await hashPassword(password);
    const { tenant, user } = await createTenantWithOwner({
      tenantName,
      email,
      passwordHash,
    });

    const token = issueToken({ userId: user.id, tenantId: tenant.id, role: user.role });

    return res.status(201).json({
      token,
      user: { id: user.id, email: user.email, role: user.role },
      tenant: { id: tenant.id, name: tenant.name },
    });
  } catch (err) {
    console.error('Signup failed:', err.message);
    return res.status(500).json({ error: 'Failed to create account' });
  }
});

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      // Same error as a wrong password — don't reveal whether the email exists.
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = issueToken({ userId: user.id, tenantId: user.tenant_id, role: user.role });

    return res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Login failed:', err.message);
    return res.status(500).json({ error: 'Failed to log in' });
  }
});

module.exports = router;
