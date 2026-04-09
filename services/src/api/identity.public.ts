import { AppContext } from '../types.js'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { createChallenge, issueLicense, getIdentityView } from '../identity.js'

const issuePayloadSchema = z.object({
	proof: z.object({
		proof_type: z.literal('jwt'),
		jwt: z.string().trim().min(1),
	}),
})

export default function publicApi(ctx: AppContext) {
	const app = new Hono()

	app.get('/:did/challenge', (c) => {
		const did = decodeDid(c.req.param('did'))
		return c.json(createChallenge(ctx, did))
	})

	app.post('/:did/issue', zValidator('json', issuePayloadSchema), async (c) => {
		const did = decodeDid(c.req.param('did'))
		const { proof } = c.req.valid('json')
		return c.json(await issueLicense(ctx, did, proof.jwt))
	})

	app.get('/:did', (c) => {
		const did = decodeDid(c.req.param('did'))
		return c.json(getIdentityView(ctx, did))
	})

	return app
}

function decodeDid(value: string): string {
	return decodeURIComponent(value)
}
