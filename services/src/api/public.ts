import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logRequestResponses, parseBind } from '../utils.js'
import { info } from '../logger.js'
import { AppContext } from '../types.js'
import { HTTPException } from 'hono/http-exception'

import publicApiNodes from './nodes.public.js'
import publicApiIdentity from './identity.public.js'

export function initPublicApi(ctx: AppContext) {
	const app = new Hono()
	const { hostname, port } = parseBind(ctx.config.api.public)

	app.onError((err, c) => {
		if (err instanceof HTTPException) {
			return c.json({ message: err.message }, err.status)
		}
		return c.json({ message: 'Internal Server Error' }, 500)
	})

	app.use(logRequestResponses(ctx, 'api/public'))

	app.get('/', (c) =>
		c.json({
			name: 'InterledgerIdentityProviderV1-Public',
			version: ctx.version,
		}),
	)

	app.route('/nodes', publicApiNodes(ctx))

	app.route('/identity', publicApiIdentity(ctx))

	const server = serve({
		fetch: app.fetch,
		port,
		hostname,
	})

	info(ctx, 'public', `public api listening on ${hostname}:${port}`)

	return server
}
