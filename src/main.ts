/**
 * NestJS application entry point.
 * Supports local execution in development mode and deployment as Firebase Function.
 */

import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './app.module';
import { Env } from './config/env.config';
import { Utils } from './utils';
import express from 'express';
import cors from 'cors';
import { onRequest } from 'firebase-functions/v2/https';

/** NestJS logger scope types */
type LoggerScope = 'error' | 'warn' | 'log' | 'debug' | 'verbose' | 'fatal';

// Create an Express instance for integration with NestJS
const expressApp = express();

// Configure Express middlewares
expressApp.use(cors({ origin: Env.corsOrigin }));
expressApp.use(express.json());
expressApp.use(express.urlencoded({ extended: true }));
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
  if (Env.nodeEnv === 'dev') {
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
export const api = onRequest(
  { cors: true, region: 'southamerica-east1' },
  async (req, res) => {
    await createNestApplication();
    expressApp(req, res);
  },
);

// Local development
void createNestApplication().then(() => {
  const port = Env.port;
  expressApp.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(
      `🔒 CORS configured for origins: ${JSON.stringify(Env.corsOrigin)}`,
    );
  });
});
