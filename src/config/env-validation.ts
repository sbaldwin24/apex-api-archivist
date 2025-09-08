export function validateEnvironment() {
  const required = [
    'NODE_ENV',
    'PORT',
    'DB_HOST',
    'DB_USER', 
    'DB_PASSWORD',
    'DB_NAME',
    'JWT_SECRET'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate JWT secret length
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }

  console.log('✅ Environment variables validated');
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || '3000'),
  database: {
    host: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
    ssl: process.env.DB_SSL === 'true',
    max: Number(process.env.DB_MAX_CONNECTIONS || '20')
  },
  security: {
    jwtSecret: process.env.JWT_SECRET!,
    corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['*'],
    rateLimit: {
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
      max: Number(process.env.RATE_LIMIT_MAX_REQUESTS || '1000')
    }
  },
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3Bucket: process.env.S3_BUCKET_NAME
  },
  monitoring: {
    logLevel: process.env.LOG_LEVEL || 'info',
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    sentryDsn: process.env.SENTRY_DSN
  },
  cache: {
    redisUrl: process.env.REDIS_URL,
    ttl: Number(process.env.CACHE_TTL || '3600')
  }
};
