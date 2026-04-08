import { z } from 'zod'
import { deleteTrustedIdentity, getTrustedIdentities, putTrustedIdentity } from '../identity.ts'
import { setNodes } from '../nodes.ts'
import { jsonValidator } from './utils.ts'
import type { Hono } from 'hono'
import type { AppContext, DID, IdentityStatus } from '../types.ts'

const identityPayloadSchema = z.object({
	status: z.enum(['active', 'revoked']),
	legalInformation: z.object({
		name: z.string().trim().min(1),
		street: z.string().trim().min(1),
		city: z.string().trim().min(1),
		country: z.string().trim().min(1),
		email: z.string().trim().email(),
		website: z.string().trim().url(),
	}).passthrough(),
})

const nodesPayloadSchema = z.array(z.string().trim().url())

export function installPrivateApi(app: Hono, ctx: AppContext) {
	app.get('/identities', c => c.json(getTrustedIdentities(ctx)))

	app.put('/identities/:did', jsonValidator(identityPayloadSchema), c => {
		const did = decodeDid(c.req.param('did'))
		const { status, legalInformation } = c.req.valid('json')
		return c.json(
			putTrustedIdentity(ctx, did, status as IdentityStatus, legalInformation),
		)
	})

	app.delete('/identities/:did', c => {
		const did = decodeDid(c.req.param('did'))
		return c.json({ did, deleted: deleteTrustedIdentity(ctx, did) })
	})

	app.put('/nodes', jsonValidator(nodesPayloadSchema), c => {
		const urls = c.req.valid('json')
		return c.json(setNodes(ctx, urls))
	})
}

function decodeDid(value: string): DID {
	return decodeURIComponent(value) as DID
}
