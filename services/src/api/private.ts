import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { serve } from '@hono/node-server'
import { parseBind } from '../utils.js'
import { info } from '../logger.js'
import { AppContext } from '../types.js'

import privateApiIdentity from './identity.private.js'

export function initPrivateApi(ctx: AppContext) {
	const app = new Hono()
	const { hostname, port } = parseBind(ctx.config.api.private)

	app.use('*', logger())

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
