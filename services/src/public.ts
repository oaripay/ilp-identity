import { AppContext } from './types'
import { serve } from '@hono/node-server'
import publicApiNodes from './entrynodes/nodes.js'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { parseBind } from './utils'

export function initPublicApi(ctx: AppContext) {
	const app = new Hono()
	const { hostname, port } = parseBind(ctx.config.api.public)

	app.use('*', logger())
	app.route('/nodes', publicApiNodes(ctx))

	const server = serve({
		fetch: app.fetch,
		port,
		hostname,
	})

	return server
}
