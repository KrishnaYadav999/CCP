require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const leadRoutes = require('./routes/leads');
const clientRoutes = require('./routes/clients');
const ccpRoutes = require('./routes/ccp');
const crmRoutes = require('./routes/crm');
const { startPendingApprovalDigest } = require('./utils/pendingApprovalDigest');

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection', err);
});

const app = express();
app.use(express.json({ limit: '3mb' }));
const defaultAllowedOrigins = ['http://localhost:8080', 'http://localhost:5173'];
const allowedOrigins = [
  ...defaultAllowedOrigins,
  ...String(process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  }
}));

connectDB();

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/ccp', ccpRoutes);
app.use('/api/crm', crmRoutes);

app.get('/', (req, res) => res.send({ ok: true, app: 'CCP', env: process.env.NODE_ENV }));

const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startPendingApprovalDigest();
});
