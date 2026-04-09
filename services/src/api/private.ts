import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { info } from '../logger.js'
import { logRequestResponses, parseBind } from '../utils.js'
import { AppContext } from '../types.js'
import { HTTPException } from 'hono/http-exception'

import privateApiIdentity from './identity.private.js'

export function initPrivateApi(ctx: AppContext) {
	const app = new Hono()
	const { hostname, port } = parseBind(ctx.config.api.private)

	app.onError((err, c) => {
		if (err instanceof HTTPException) {
			return c.json({ message: err.message }, err.status)
		}
		return c.json({ message: 'Internal Server Error' }, 500)
	})

	app.use(logRequestResponses(ctx, 'api/private'))

	app.get('/', (c) =>
		c.json({
			name: 'InterledgerIdentityProviderV1-Private',
			version: ctx.version,
		}),
	)

	app.route('/identities', privateApiIdentity(ctx))

	const server = serve({
		fetch: app.fetch,
		port,
		hostname,
	})

	info(ctx, 'private', `private api listening on ${hostname}:${port}`)

	return server
}
