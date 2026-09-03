import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory or project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ecourts_db',
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
  DB_NAME: process.env.DB_NAME || 'ecourts_db',
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || 'postgres',
  DB_SSL: process.env.DB_SSL === 'true',

  // Authentication
  JWT_SECRET: process.env.JWT_SECRET || 'super_secret_access_jwt_key_legaltech_2026_dev',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'super_secret_refresh_jwt_key_legaltech_2026_dev',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // Redis
  REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,

  // AWS S3 Placeholder
  AWS_REGION: process.env.AWS_REGION || 'ap-south-1',
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || 'mock_aws_access_key_id',
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || 'mock_aws_secret_access_key',
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || 'ecourts-documents-storage',

  // eCourts API
  ECOURTS_API_BASE_URL: process.env.ECOURTS_API_BASE_URL || 'https://api.ecourts.gov.in/v1',
  ECOURTS_API_KEY: process.env.ECOURTS_API_KEY || 'mock_ecourts_api_key',
  // Set ECOURTS_USE_MOCK=true in .env.test or test scripts to force mock mode even with a live key.
  // In production, leave unset or false to use the live upstream API.
  ECOURTS_USE_MOCK: process.env.ECOURTS_USE_MOCK === 'true',

  // Frontend URL
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
};
