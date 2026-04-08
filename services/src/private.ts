import { Hono } from 'hono'
import { AppContext } from './types.js'
import { logger } from 'hono/logger'
import { serve } from '@hono/node-server'
import { parseBind } from './utils.js'
import { info } from './logger.js'

export function initPrivateApi(ctx: AppContext) {
	const app = new Hono()
	const { hostname, port } = parseBind(ctx.config.api.private)

	app.use('*', logger())
	app.get('/', (c) => c.text('Private endpoint'))

	const server = serve({
		fetch: app.fetch,
		port,
		hostname,
	})

	info(ctx, 'api/private', `public api listening on ${hostname}:${port}`)

	return server
}
