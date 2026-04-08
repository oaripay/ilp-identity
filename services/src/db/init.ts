import Database from 'better-sqlite3'
import type { AppContext } from '../types.ts'

export function initDatabase(ctx: AppContext) {
	const db = new Database(ctx.config.db.file)

	db.exec(`
		CREATE TABLE IF NOT EXISTS identities (
			did TEXT PRIMARY KEY,
			status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
			legal_information TEXT NOT NULL,
			license_id TEXT,
			license TEXT
		);

		CREATE TABLE IF NOT EXISTS challenges (
			did TEXT PRIMARY KEY,
			nonce TEXT NOT NULL,
			expires_at INTEGER NOT NULL,
			FOREIGN KEY (did) REFERENCES identities(did) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS nodes (
			id INTEGER PRIMARY KEY CHECK (id = 1),
			urls TEXT NOT NULL
		);
	`)

	return db
}
