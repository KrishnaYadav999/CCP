require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const leadRoutes = require('./routes/leads');
const clientRoutes = require('./routes/clients');
const ccpRoutes = require('./routes/ccp');
const crmRoutes = require('./routes/crm');

const app = express();

app.use(express.json({ limit: '3mb' }));

const defaultAllowedOrigins = [
  'http://localhost:8080',
  'http://localhost:5173',
  'https://ccp-henna.vercel.app'
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

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin) || isAllowedVercelOrigin(origin)) {
      return callback(null, true);
    }

    const error = new Error(`CORS blocked for origin: ${origin}`);
    error.statusCode = 403;
    return callback(error);
  }
}));
app.options('*', cors());

app.use(async (req, res, next) => {
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
