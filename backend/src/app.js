require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const leadRoutes = require('./routes/leads');
const clientRoutes = require('./routes/clients');
const ccpRoutes = require('./routes/ccp');
const crmRoutes = require('./routes/crm');
const teamRoutes = require('./routes/teams');
const notificationRoutes = require('./routes/notifications');
const quotationRoutes = require('./routes/quotations');
const mediaRoutes = require('./routes/media');
const { rejectEmbeddedMedia } = require('./controllers/mediaController');

const app = express();

app.use(express.json({ limit: '25mb' }));

const defaultAllowedOrigins = [
  'http://localhost:8080',
  'http://localhost:6173',
  'http://localhost:6000',
  'https://ccp-henna.vercel.app',
  'https://crm-1-eight.vercel.app',
  'https://crm-1-n88d.vercel.app'
];
const allowedOrigins = [
  ...defaultAllowedOrigins,
  ...String(process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
];

function isAllowedVercelOrigin(origin) {
  try {
    const { hostname, protocol } = new URL(origin);
    return protocol === 'https:' && hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin) || isAllowedVercelOrigin(origin)) {
      return callback(null, true);
    }

    const error = new Error(`CORS blocked for origin: ${origin}`);
    error.statusCode = 403;
    return callback(error);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-ccp-api-key', 'x-ccp-secret', 'x-action-by'],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(rejectEmbeddedMedia);

function isPublicCcpReadRequest(req) {
  return req.method === 'GET' && req.path === '/api/ccp/clients';
}

app.use(async (req, res, next) => {
  if (isPublicCcpReadRequest(req)) return next();

  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

app.get('/', (req, res) => res.send({ ok: true, app: 'CCP', env: process.env.NODE_ENV }));
app.get('/api/health', (req, res) => res.json({ ok: true, app: 'CCP', env: process.env.NODE_ENV }));

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/ccp', ccpRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/media', mediaRoutes);

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error('Request failed', err);
  const status = err.statusCode || err.status || 500;
  const message = status >= 500 && process.env.NODE_ENV === 'production'
    ? 'Server error. Please check backend environment variables and logs.'
    : err.message || 'Server error';
  return res.status(status).json({ ok: false, error: message });
});

module.exports = app;
