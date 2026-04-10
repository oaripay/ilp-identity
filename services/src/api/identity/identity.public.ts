import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import {
	createChallenge,
	issueLicense,
	getIdentityView,
} from '../../identity.js'
import { AppContext } from '../../types.js'

const issuePayloadSchema = z.object({
	proof: z.object({
		proof_type: z.literal('jwt'),
		jwt: z.string(),
	}),
})

export default function publicApi(ctx: AppContext) {
	const app = new Hono()

	app.get('/:did/challenge', async (c) => {
		const did = decodeURIComponent(c.req.param('did'))
		return c.json(await createChallenge(ctx, did))
	})

	app.post('/:did/issue', zValidator('json', issuePayloadSchema), async (c) => {
		const did = decodeURIComponent(c.req.param('did'))
		const { proof } = c.req.valid('json')
		return c.json({ vc: await issueLicense(ctx, did, proof.jwt) })
	})

	app.get('/:did', async (c) => {
		const did = decodeURIComponent(c.req.param('did'))
		return c.json(await getIdentityView(ctx, did))
	})

	return app
}
