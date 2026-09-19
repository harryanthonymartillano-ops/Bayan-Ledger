import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import path from 'path';

import { initializeDatabase } from './db/config';
import { logger } from './logger';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import milestoneRoutes from './routes/milestones';
import transactionRoutes from './routes/transactions';
import documentRoutes from './routes/documents';
import auditLogRoutes from './routes/auditLogs';
import blockchainRoutes from './routes/blockchain';
import systemAlertRoutes from './routes/systemAlerts';
import notificationRoutes from './routes/notifications';

config();

const app = express();
const port = Number(process.env.PORT || 5000);
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_PRODUCTION_URL,
].filter(Boolean) as string[];

app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', (_req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.removeHeader('X-Frame-Options');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https:; frame-ancestors *;"
  );
  next();
});
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'sta-cruz-backend',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/milestones', milestoneRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/system-alerts', systemAlertRoutes);
app.use('/api/notifications', notificationRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled backend error:', err);
  res.status(500).json({
    error: err?.message || 'Internal server error',
  });
});

initializeDatabase()
  .then(() => {
    app.listen(port, () => {
      logger.info(`Backend API listening on port ${port}`);
      console.log(`Backend API listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    logger.error('Backend startup failed:', error);
    process.exit(1);
  });
