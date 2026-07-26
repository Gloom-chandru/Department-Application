import dotenv from 'dotenv';
dotenv.config();

const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET'
];

const missing = requiredEnvVars.filter(v => !process.env[v]);

if (missing.length > 0) {
  // Print names of missing variables only, never log actual credentials
  console.error(`FATAL CONFIGURATION ERROR: The following required environment variables are missing: ${missing.join(', ')}`);
  process.exit(1);
}

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtExpire: process.env.JWT_EXPIRE || '8h',
  jwtRefreshExpire: process.env.JWT_REFRESH_EXPIRE || '7d',
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173'],
  maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE || '5242880', 10), // Default: 5MB in bytes
};
