const path = require('path');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { ZodError } = require('zod');

const { env, requireEnv } = require('./config/env');
const { pool } = require('./config/db');
const { currentUser, requireAuth } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/error');

const authRoutes = require('./routes/auth.routes');
const customerRoutes = require('./routes/customers.routes');
const productRoutes = require('./routes/products.routes');
const quotationRoutes = require('./routes/quotations.routes');
const orderRoutes = require('./routes/orders.routes');
const invoiceRoutes = require('./routes/invoices.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const reportRoutes = require('./routes/reports.routes');
const paymentRoutes = require('./routes/payments.routes');
const employeeRoutes = require('./routes/employees.routes');
const supplierRoutes = require('./routes/suppliers.routes');
const expenseRoutes = require('./routes/expenses.routes');
const settingsRoutes = require('./routes/settings.routes');
const backupRoutes = require('./routes/backups.routes');
const securityRoutes = require('./routes/security.routes');

requireEnv();

const app = express();
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false
}));

if (env.nodeEnv !== 'production') {
  app.use(cors({
    origin: env.clientOrigin,
    credentials: true
  }));
}

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  name: 'shree_upvc_sid',
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: new PgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: false
  }),
  cookie: {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use(currentUser);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    company: 'SHREE UPVC WINDOWS & DOORS'
  });
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/customers', requireAuth, customerRoutes);
app.use('/api/products', requireAuth, productRoutes);
app.use('/api/quotations', requireAuth, quotationRoutes);
app.use('/api/orders', requireAuth, orderRoutes);
app.use('/api/invoices', requireAuth, invoiceRoutes);
app.use('/api/payments', requireAuth, paymentRoutes);
app.use('/api/employees', requireAuth, employeeRoutes);
app.use('/api/suppliers', requireAuth, supplierRoutes);
app.use('/api/expenses', requireAuth, expenseRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/reports', requireAuth, reportRoutes);
app.use('/api/settings', requireAuth, settingsRoutes);
app.use('/api/backups', requireAuth, backupRoutes);
app.use('/api/security', requireAuth, securityRoutes);

const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  return res.sendFile(path.join(clientDist, 'index.html'));
});

app.use((error, req, res, next) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: 'Invalid request data',
      details: error.errors.map((item) => ({
        field: item.path.join('.'),
        message: item.message
      }))
    });
  }

  return errorHandler(error, req, res, next);
});
app.use(notFound);

async function start() {
  await pool.query('SELECT 1');
  app.listen(env.port, () => {
    console.log(`SHREE UPVC server running on port ${env.port}`);
  });
}

start().catch((error) => {
  console.error('Unable to start server', error);
  process.exit(1);
});
