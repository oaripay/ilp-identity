import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const didDocuments = sqliteTable('did_documents', {
	id: text('id').primaryKey(),
	did: text('did').notNull().unique(),
	document: text('document').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
})

export const credentials = sqliteTable('credentials', {
	id: text('id').primaryKey(),
	issuerDid: text('issuer_did').notNull(),
	subjectDid: text('subject_did')
		.references(() => didDocuments.did, {
			onDelete: 'cascade',
		})
		.notNull(),
	type: text('type').notNull(),
	jwt: text('jwt').notNull(),
	issuedAt: integer('issued_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	expiresAt: integer('expires_at', { mode: 'timestamp' }),
})

export const entryNodes = sqliteTable('entry_nodes', {
	id: text('id').primaryKey(),
	url: text('url').notNull().unique(),
	did: text('subject_did')
		.references(() => didDocuments.did, {
			onDelete: 'cascade',
		})
		.notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
})
