import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Route imports
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import healthRoutes from './modules/health/health.routes.js';
import queueRoutes from './modules/queues/queue.routes.js';
import settingsRoutes from './modules/settings/settings.routes.js';
import courtRoutes from './modules/courts/courts.routes.js';
import discoveryRoutes from './modules/discovery/discovery.routes.js';
import casesRoutes from './modules/cases/cases.routes.js';
import backfillRoutes from './modules/backfill/backfill.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';

const app = express();

// Security and utility middleware
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server) or wildcard
      if (!origin || env.FRONTEND_URL === '*' || env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      const allowed = [env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'];
      if (allowed.includes(origin) || origin.endsWith('.onrender.com') || origin.endsWith('.vercel.app') || origin.endsWith('.netlify.app')) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (skip in test mode)
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Root health check endpoint (GET /health)
app.use('/health', healthRoutes);

// API v1 Mounts
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/queues', queueRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/courts', courtRoutes);
app.use('/api/discovery', discoveryRoutes);
app.use('/api/cases', casesRoutes);
app.use('/api/backfill', backfillRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 404 Handler
app.use(notFoundHandler);

// Centralized Error Handler
app.use(errorHandler);

export default app;
