import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

import * as schema from './schema';

const requireEnv = (key: string): string => {
	const value = process.env[key];
	if (!value) {
		throw new Error(`missing required env var: ${key}`);
	}
	return value;
};

const pool = mysql.createPool({
	host: requireEnv('DB_ENDPOINT'),
	port: Number(requireEnv('DB_PORT')),
	user: requireEnv('DB_USER'),
	password: requireEnv('DB_PASSWORD'),
	database: requireEnv('DB_SCHEMA'),
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

	async executeQuery<T>(query: QueryFunction<T>, connection: Connection | null = null): Promise<T> {
		const client = drizzleClient.getClient(connection);
		return query(client);
	},

	async executeQueryWithTransaction<T>(transaction: TransactionFunction<T>): Promise<T> {
		return db.transaction(async (tx) => transaction(tx));
	},
};

export type DrizzleClient = typeof drizzleClient;
