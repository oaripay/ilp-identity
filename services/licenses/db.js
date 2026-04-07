import path from 'path'
import Database from 'better-sqlite3'
import type { AppContext, Caip2Chain, Caip19Asset } from './types.js'

export function openDb(dataDir: string): Database {
	const dbPath = path.join(dataDir, 'store.db')
	const db = new Database(dbPath)

	db.exec(`
		CREATE TABLE IF NOT EXISTS Chains (
			id TEXT NOT NULL PRIMARY KEY,
			name TEXT NOT NULL,
			aliases TEXT NOT NULL
		)
	`)

	db.exec(`
		CREATE TABLE IF NOT EXISTS Assets (
			id TEXT NOT NULL PRIMARY KEY,
			chainId TEXT NOT NULL,
			name TEXT NOT NULL,
			symbol TEXT NOT NULL,
			aliases TEXT NOT NULL,
			chainAliases TEXT NOT NULL
		)
	`)

	return db
}

export function readChains(ctx: AppContext): Array<Caip2Chain> {
	const rows = ctx.db
		.prepare(`
			SELECT id, name, aliases
			FROM Chains
		`)
		.all() as Array<{ id: string; name: string; aliases: string }>

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		aliases: JSON.parse(row.aliases) as Array<string>,
	}))
}

export function writeChains(ctx: AppContext, newChains: Array<Caip2Chain>) {
	const stmt = ctx.db.prepare(`
		INSERT INTO Chains (id, name, aliases)
		VALUES (@id, @name, @aliases)
		ON CONFLICT(id) DO UPDATE SET
			name = excluded.name,
			aliases = excluded.aliases
	`)

	ctx.db.transaction(() => {
		for (const chain of newChains) {
			stmt.run({
				id: chain.id,
				name: chain.name,
				aliases: JSON.stringify(chain.aliases ?? []),
			})
		}
	})()
}

export function readAssets(ctx: AppContext): Array<Caip19Asset> {
	const rows = ctx.db
		.prepare(`
			SELECT id, chainId, name, symbol, aliases, chainAliases
			FROM Assets
		`)
		.all() as Array<{
			id: string
			chainId: string
			name: string
			symbol: string
			aliases: string
			chainAliases: string
		}>

	return rows
		.map((row) => ({
			id: row.id,
			chain: ctx.chains.find((item) => item.id === row.chainId),
			name: row.name,
			symbol: row.symbol,
			aliases: JSON.parse(row.aliases) as Array<string>,
			chainAliases: JSON.parse(row.chainAliases) as Array<string>,
		}))
		.filter((asset): asset is Caip19Asset => asset !== null)
}

export function writeAssets(ctx: AppContext, newAssets: Array<Caip19Asset>) {
	const stmt = ctx.db.prepare(`
		INSERT INTO Assets (id, chainId, name, symbol, aliases, chainAliases)
		VALUES (@id, @chainId, @name, @symbol, @aliases, @chainAliases)
		ON CONFLICT(id) DO UPDATE SET
			chainId = excluded.chainId,
			name = excluded.name,
			symbol = excluded.symbol,
			aliases = excluded.aliases,
			chainAliases = excluded.chainAliases
	`)

	ctx.db.transaction(() => {
		for (const asset of newAssets) {
			stmt.run({
				id: asset.id,
				chainId: asset.chain.id,
				name: asset.name,
				symbol: asset.symbol,
				aliases: JSON.stringify(asset.aliases ?? []),
				chainAliases: JSON.stringify(asset.chainAliases ?? []),
			})
		}
	})()
}