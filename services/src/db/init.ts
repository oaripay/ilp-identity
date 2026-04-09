import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import type { AppContext } from '../types.js'

export type AppDatabase = ReturnType<typeof drizzle>

const migrationsFolder = path.join(
	fileURLToPath(new URL('.', import.meta.url)),
	'migrations',
)

export async function initDatabase(ctx: AppContext) {
	const sqliteFile = path.join(ctx.config.dataDir, ctx.config.db.sqlite.file)

	fs.mkdirSync(path.dirname(sqliteFile), { recursive: true })

	const sqlite = new Database(sqliteFile)
	sqlite.pragma('foreign_keys = ON')
	sqlite.pragma('journal_mode = WAL')

	const db = drizzle(sqlite)

	migrate(db, { migrationsFolder })

	ctx.db = db
}
