require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../models');

const app = express();
const PORT = process.env.PORT || 4001;

// confiar en proxy (Railway)
app.set('trust proxy', 1);

// CORS
const origins = (process.env.CORS_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);            // curl/postman
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    return callback(null, origins.length === 0 || origins.includes(origin));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','x-request-id']
}));

app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// request-id para trazas
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.set('x-request-id', req.id);
  next();
});

app.use(morgan(':method :url :status - :response-time ms - :req[x-request-id]'));

// timeouts
app.use((req, res, next) => {
  req.setTimeout(30000);
  res.setTimeout(30000);
  next();
});

// Health / Readiness (podés mantener /healthz y /readyz si preferís)
app.get('/health', (_req, res) => res.json({ ok: true, service: 'auth-service' }));
app.get('/ready', async (_req, res) => {
  try { await sequelize.authenticate(); return res.json({ ok: true }); }
  catch { return res.status(503).json({ ok: false }); }
});
app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'auth-service' }));
app.get('/readyz', async (_req, res) => {
  try { await sequelize.authenticate(); return res.json({ ok: true }); }
  catch { return res.status(503).json({ ok: false }); }
});

// Rutas
const authRoutes = require('./routes/auth.routes');
app.use('/api/v1/auth', authRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(`[${req.id}] Error:`, err.message);
  if (err.code === 'ECONNABORTED' || (err.message || '').includes('request aborted')) return;
  const status = err.status || 500;
  if (res.headersSent) return next(err);
  res.status(status).json({
    error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Internal error', requestId: req.id }
  });
});

// Arranque (binding 0.0.0.0)
app.listen(PORT, '0.0.0.0', () => console.log(`auth-service on :${PORT}`));
