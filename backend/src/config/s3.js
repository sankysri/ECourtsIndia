import { env } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * AWS S3 Storage Integration Placeholder
 * Configured as a structured placeholder for document storage in later milestones.
 */

export const s3Config = {
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
  bucket: env.AWS_S3_BUCKET,
  isConfigured: Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_S3_BUCKET),
};

export const getS3Status = () => {
  return {
    configured: s3Config.isConfigured,
    region: s3Config.region,
    bucket: s3Config.bucket,
    mode: s3Config.accessKeyId?.startsWith('mock') ? 'PLACEHOLDER / MOCK' : 'READY',
  };
};

export const s3ServicePlaceholder = {
  uploadDocument: async (fileName, buffer, mimeType) => {
    logger.info(`[S3 Placeholder] Simulating upload of ${fileName} to bucket ${s3Config.bucket}`);
    return {
      success: true,
      key: `documents/${Date.now()}_${fileName}`,
      location: `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com/documents/${Date.now()}_${fileName}`,
      etag: 'mock_etag_' + Date.now(),
    };
  },
  getDocumentUrl: async (key) => {
    return `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com/${key}?mock_presigned_url=true`;
  },
};
