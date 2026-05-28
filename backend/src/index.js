require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const leadRoutes = require('./routes/leads');
const clientRoutes = require('./routes/clients');

const app = express();
app.use(express.json({ limit: '3mb' }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));

connectDB();

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/clients', clientRoutes);

app.get('/', (req, res) => res.send({ ok: true, env: process.env.NODE_ENV }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
