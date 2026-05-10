import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from './schema';

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

export type Connection = Parameters<Parameters<Db['transaction']>[0]>[0];

type QueryFunction<T> = (client: Db | Connection) => Promise<T>;
type TransactionFunction<T> = (connection: Connection) => Promise<T>;

export const drizzleClient = {
  getClient(connection: Connection | null = null): Db | Connection {
    return connection ?? db;
  },

  async executeQuery<T>(
    query: QueryFunction<T>,
    connection: Connection | null = null,
  ): Promise<T> {
    const client = drizzleClient.getClient(connection);
    return query(client);
  },

  async executeQueryWithTransaction<T>(
    transaction: TransactionFunction<T>,
  ): Promise<T> {
    return db.transaction(async (tx) => transaction(tx));
  },
};

export type DrizzleClient = typeof drizzleClient;
