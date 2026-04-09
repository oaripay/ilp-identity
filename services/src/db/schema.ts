import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const entryNodes = sqliteTable('entry_nodes', {
	id: text('id').primaryKey(),
	url: text('url').notNull().unique(),
	did: text('did').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
})

export type EntryNode = typeof entryNodes.$inferSelect

export const identities = sqliteTable('identities', {
	did: text('did').primaryKey(),
	status: text('status', { enum: ['active', 'revoked'] }).notNull(),
	legalInformation: text('legal_information', { mode: 'json' })
		.$type<{
			name: string
			street: string
			city: string
			country: string
			email: string
			website: string
			commercialRegisterNumber: string
			vatId: string
		}>()
		.notNull(),
	vcId: text('vc_id'),
	vc: text('vc'),
})

export type Identity = typeof identities.$inferSelect

export const challenges = sqliteTable('challenges', {
	did: text('did')
		.primaryKey()
		.references(() => identities.did, { onDelete: 'cascade' }),
	nonce: text('nonce').notNull(),
	createdAt: integer('created_at').notNull(),
	expiresAt: integer('expires_at').notNull(),
})

export type Challenge = typeof challenges.$inferSelect
