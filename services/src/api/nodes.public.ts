import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { entryNodes } from '../db/schema.js'
import { randomUUID } from 'crypto'
import { AppContext } from '../types.js'
import { verifyVp } from '../resolver.js'

const createNodeSchema = z.object({
	url: z.url(),
	vpJwt: z.string(),
})

export default function publicApi(ctx: AppContext) {
	const app = new Hono()
	const db = ctx.db!

	app.get('/', async (c) => {
		const all = await db.select().from(entryNodes)
		const nodes = all.map((n) => ({
			id: n.id,
			url: n.url,
		}))
		return c.json(nodes)
	})

	app.post('/', zValidator('json', createNodeSchema), async (c) => {
		const { url, vpJwt } = c.req.valid('json')
		let did
		try {
			did = await verifyVp(ctx, vpJwt)
		} catch (e) {
			return c.json({ error: 'Invalid VP JWT' }, 403)
		}
		const id = randomUUID()
		const [node] = await db
			.insert(entryNodes)
			.values({ id, url, did, createdAt: new Date() })
			.returning()
		return c.json(node, 201)
	})

	app.delete('/:id', zValidator('json', createNodeSchema), async (c) => {
		const id = c.req.param('id')
		const { url, vpJwt } = c.req.valid('json')
		let did
		try {
			did = await verifyVp(ctx, vpJwt)
		} catch (e) {
			return c.json({ error: 'Invalid VP JWT' }, 403)
		}
		const [existing] = await db
			.select()
			.from(entryNodes)
			.where(
				eq(entryNodes.id, id) &&
					eq(entryNodes.url, url) &&
					eq(entryNodes.did, did),
			)

		if (!existing) {
			return c.json({ error: 'Entry node not found' }, 404)
		}
		await db.delete(entryNodes).where(eq(entryNodes.id, id))
		return c.json({ message: 'Entry node deleted' })
	})

	return app
}
