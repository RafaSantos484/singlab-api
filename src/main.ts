/**
 * NestJS application entry point.
 * Supports local execution in development mode and deployment as Firebase Function.
 */

import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { INestApplication, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { Env } from './config/env.config';
import { Utils } from './utils';
import { GlobalExceptionFilter } from './common/filters';
import express from 'express';
import cors from 'cors';
import { onRequest } from 'firebase-functions/v2/https';

/** NestJS logger scope types */
type LoggerScope = 'error' | 'warn' | 'log' | 'debug' | 'verbose' | 'fatal';

/** Logger instance for bootstrapping messages */
const logger = new Logger('Bootstrap');

// Create an Express instance for integration with NestJS
const expressApp = express();

// Configure Express middlewares
expressApp.use(cors({ origin: Env.corsOrigin }));

// Body parser with 50kb limit for most routes
// Routes that need larger payloads (audio files, large JSON) are handled by multer
expressApp.use((req, res, next) => {
  // Skip body parser for upload routes
  if (req.path.includes('/upload')) {
    return next();
  }
  express.json({ limit: '50kb' })(req, res, next);
});

expressApp.use((req, res, next) => {
  // Skip urlencoded parser for upload routes
  if (req.path.includes('/upload')) {
    return next();
  }
  express.urlencoded({ extended: true, limit: '50kb' })(req, res, next);
});

expressApp.use((req, _res, next) => {
  if (req.body) {
    req.body = Utils.trim(req.body);
  }
  next();
});

/**
 * NestJS application cache for reuse in subsequent invocations.
 * Essential for performance in serverless environments (Firebase Functions).
 */
let cachedApp: INestApplication | null = null;

/**
 * Creates and initializes the NestJS application.
 * In serverless environment, reuses the cached instance for better performance.
 *
 * @returns Initialized NestJS instance
 */
async function createNestApplication(): Promise<INestApplication> {
  // Return cached instance if it already exists
  if (cachedApp) {
    return cachedApp;
  }

  // Define log levels based on environment
  const loggerScopes: LoggerScope[] = ['error', 'warn', 'log'];
  if (Env.nodeEnv === 'dev' || Env.nodeEnv === 'local') {
    loggerScopes.push('debug', 'verbose');
  }

  // Create NestJS application with Express as adapter
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { logger: loggerScopes, bodyParser: false },
  );

  // Configure CORS to allow frontend requests
  app.enableCors({
    origin: Env.corsOrigin,
    credentials: true,
  });

  // Apply global exception filter for standardized error responses
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Initialize the application
  await app.init();

  // Store in cache for reuse
  cachedApp = app;

  return app;
}

/**
 * Exports the API as a Firebase Function.
 * This function is automatically invoked by Firebase when an HTTP request is received.
 */
export const api = onRequest({ cors: true }, async (req, res) => {
  await createNestApplication();
  expressApp(req, res);
});

/**
 * Starts the local development server only in dev/local environments.
 * In production (Firebase Functions), the server is managed by Firebase.
 */
if (Env.nodeEnv === 'dev' || Env.nodeEnv === 'local') {
  void createNestApplication().then(() => {
    const port = Env.port;
    expressApp.listen(port, () => {
      logger.log(`🌐 HTTP Server running on http://localhost:${port}`);
      logger.log(`🔒 CORS configured for: ${JSON.stringify(Env.corsOrigin)}`);
      logger.log(`🎵 SingLab API - Ready to accept song uploads`);
    });
  });
} else if (Env.nodeEnv === 'production') {
  logger.log('🚀 NestJS application initialized in production');
  logger.log('☁️  Firebase Functions - active');
  logger.log(`🔒 CORS configured for: ${JSON.stringify(Env.corsOrigin)}`);
} else {
  logger.log(`ℹ️  Environment: ${Env.nodeEnv}`);
  logger.log(`🔒 CORS configured for: ${JSON.stringify(Env.corsOrigin)}`);
}
