import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './infra/sql/drizzle',
  dialect: 'mysql',
  dbCredentials: {
    host: process.env.DB_ENDPOINT!,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_SCHEMA!,
  },
  verbose: true,
  strict: true,
});
