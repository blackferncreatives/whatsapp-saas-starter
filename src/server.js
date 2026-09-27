require('dotenv').config();
const express = require('express');
const cors = require('cors');

const onboardingRouter = require('./routes/onboarding');
const webhookRouter = require('./routes/webhook');
const campaignsRouter = require('./routes/campaigns');
const contactsRouter = require('./routes/contacts');
const authRouter = require('./routes/auth');
const { requireAuth } = require('./middleware/auth');

const app = express();

app.use(cors());

// Webhook routes need the raw request body to verify Meta's signature,
// so they get their own body parser BEFORE the general JSON parser below.
app.use(
  '/api',
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
  webhookRouter
);

// Everything else uses the standard JSON parser.
app.use(express.json());

// Public: signup/login issue the token everything below requires.
app.use('/api', authRouter);

// Protected: requireAuth attaches req.user = { id, tenantId, role }.
// Route handlers should use req.user.tenantId, not a tenantId from the
// request body, so one tenant can never act on another's data.
app.use('/api', requireAuth, onboardingRouter);
app.use('/api', requireAuth, campaignsRouter);
app.use('/api', requireAuth, contactsRouter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`WhatsApp SaaS backend listening on port ${PORT}`);
  console.log(`Webhook URL to register with Meta: ${process.env.APP_BASE_URL}/api/webhook`);
});
