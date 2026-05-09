import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from './schema.js';

const pool = mysql.createPool({
  host: process.env.DB_ENDPOINT!,
  port: Number(process.env.DB_PORT!),
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_SCHEMA!,
  connectionLimit: 1,
  waitForConnections: true,
});

export const db = drizzle(pool, { schema, mode: 'default' });

export type Db = typeof db;
