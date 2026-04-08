import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { entryNodes } from '../db/schema.js'
import { randomUUID } from 'crypto'
import { AppContext } from '../types.js'

const createNodeSchema = z.object({
	url: z.url(),
	did: z.string(),
})

export default function publicApi(ctx: AppContext) {
	const app = new Hono()
	const db = ctx.db

	app.get('/', async (c) => {
		const all = await db.select().from(entryNodes)
		const text = all.map((n) => n.url).join('\n')
		return c.text(text)
	})

	// TODO: node can put itself inside if it can issue a VP
	app.post('/', zValidator('json', createNodeSchema), async (c) => {
		const { url, did } = c.req.valid('json')
		const id = randomUUID()
		const [node] = await db
			.insert(entryNodes)
			.values({ id, url, did, createdAt: new Date() })
			.returning()
		return c.json(node, 201)
	})

	// TODO: nodes can delete the endpoint from the registry if issued a VP
	app.delete('/:id', async (c) => {
		const id = c.req.param('id')
		const [existing] = await db
			.select()
			.from(entryNodes)
			.where(eq(entryNodes.id, id))
		if (!existing) {
			return c.json({ error: 'Entry node not found' }, 404)
		}
		await db.delete(entryNodes).where(eq(entryNodes.id, id))
		return c.json({ message: 'Entry node deleted' })
	})

	return app
}
