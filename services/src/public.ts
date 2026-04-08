import { AppContext } from './types.js'
import { serve } from '@hono/node-server'
import publicApiNodes from './entrynodes/nodes.public.js'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { parseBind } from './utils.js'
import { info } from './logger.js'

export function initPublicApi(ctx: AppContext) {
	const app = new Hono()
	const { hostname, port } = parseBind(ctx.config.api.public)

	app.use('*', logger())
	app.get('/', (c) => c.text('Public endpoint'))
	app.route('/nodes', publicApiNodes(ctx))

	const server = serve({
		fetch: app.fetch,
		port,
		hostname,
	})

	info(ctx, 'api/private', `public api listening on ${hostname}:${port}`)

	return server
}
