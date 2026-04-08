import { z } from 'zod'
import { createChallenge, getIdentityView, issueLicense } from '../identity.ts'
import { getNodes } from '../nodes.ts'
import { jsonValidator } from './utils.ts'
import type { Hono } from 'hono'
import type { AppContext, DID } from '../types.ts'

const issuePayloadSchema = z.object({
	proof: z.object({
		proof_type: z.literal('jwt'),
		jwt: z.string().trim().min(1),
	}),
})

export function installPublicApi(app: Hono, ctx: AppContext) {
	app.get('/nodes', c => c.json(getNodes(ctx)))

	app.get('/identity/:did/challenge', c => {
		const did = decodeDid(c.req.param('did'))
		return c.json(createChallenge(ctx, did))
	})

	app.post('/identity/:did/issue', jsonValidator(issuePayloadSchema), async c => {
		const did = decodeDid(c.req.param('did'))
		const { proof } = c.req.valid('json')
		return c.json(await issueLicense(ctx, did, proof.jwt))
	})

	app.get('/identity/:did', c => {
		const did = decodeDid(c.req.param('did'))
		return c.json(getIdentityView(ctx, did))
	})
}

function decodeDid(value: string): DID {
	return decodeURIComponent(value) as DID
}
