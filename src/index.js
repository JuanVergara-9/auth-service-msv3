require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../models');

const app = express();
const PORT = process.env.PORT || 4001;

// CORS
const origins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ 
  origin: (origin, callback) => {
    // Permitir requests sin origin (mobile apps, postman, etc.)
    if (!origin) return callback(null, true);
    // Permitir todos los origins en desarrollo
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    // En producción, verificar origins específicos
    if (origins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  }, 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id']
})); 

app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use((req, res, next) => { req.id = req.headers['x-request-id'] || uuidv4(); res.set('x-request-id', req.id); next(); });
app.use(morgan(':method :url :status - :response-time ms - :req[x-request-id]'));

// Middleware para timeout
app.use((req, res, next) => {
  req.setTimeout(30000); // 30 segundos timeout
  res.setTimeout(30000);
  next();
});

// Rutas
app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'auth-service' }));
app.get('/readyz', async (_req, res) => {
  try { await sequelize.authenticate(); return res.json({ ok: true }); }
  catch (e) { return res.status(503).json({ ok: false }); }
});

const authRoutes = require('./routes/auth.routes');
app.use('/api/v1/auth', authRoutes);

// Error handler (catch-all)
app.use((err, req, res, next) => {
  console.error(`[${req.id}] Error:`, err.message);
  
  // Si la conexión fue abortada, no enviar respuesta
  if (err.code === 'ECONNABORTED' || err.message.includes('request aborted')) {
    console.error(`[${req.id}] Request aborted, not sending response`);
    return;
  }
  
  const status = err.status || 500;
  const message = err.message || 'Internal error';
  
  // Si la respuesta ya fue enviada, no hacer nada
  if (res.headersSent) {
    console.error(`[${req.id}] Headers already sent, cannot send error response`);
    return next(err);
  }
  
  res.status(status).json({
    error: { 
      code: err.code || 'INTERNAL_ERROR', 
      message: message,
      requestId: req.id 
    }
  });
});

app.listen(PORT, () => console.log(`auth-service on :${PORT}`));
