import { AppContext } from '../types.js'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { identities, Identity } from '../db/schema.js'
import { Hono } from 'hono'
import { eq } from 'drizzle-orm'

const updateRecordSchema = z.object({
	status: z.enum(['active', 'revoked']),
	legalInformation: z.custom<Identity['legalInformation']>(),
})

export default function privateApi(ctx: AppContext) {
	const app = new Hono()
	const db = ctx.db!

	app.get('/', async (c) => {
		const selected = await db.select().from(identities)
		return c.json(
			Object.fromEntries(selected.map((entry) => [entry.did, entry])),
		)
	})

	app.put('/:did', zValidator('json', updateRecordSchema), async (c) => {
		const did = decodeURIComponent(c.req.param('did'))
		const record = c.req.valid('json')
		const [returnPayload] = await db
			.update(identities)
			.set({ status: record.status, legalInformation: record.legalInformation })
			.where(eq(identities.did, did))
			.returning({
				did: identities.did,
				status: identities.status,
				legalInformation: identities.legalInformation,
			})
		if (!returnPayload) {
			return c.json('Identity not found', 404)
		}
		return c.json(returnPayload)
	})

	app.delete('/:did', async (c) => {
		const did = decodeURIComponent(c.req.param('did'))
		const [resultIdentity] = await db
			.delete(identities)
			.where(eq(identities.did, did))
			.returning({ did: identities.did })

		if (!resultIdentity.did) {
			return c.json({ message: 'Identity not found' }, 404)
		}

		return c.json(`Identity ${resultIdentity.did} deleted`)
	})

	return app
}
