import 'dotenv/config';
export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  databaseSsl: process.env.DATABASE_SSL !== 'false',
  jwtSecret: process.env.JWT_SECRET ?? '',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(','),
};
