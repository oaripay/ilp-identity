import { serve } from '@hono/node-server'
import { Hono } from 'hono'

import { logRequestResponses, parseBind } from '../utils.js'
import { HTTPException } from 'hono/http-exception'
import { AppContext } from '../types.js'
import { info } from '../logger.js'

import publicApiNodes from './nodes/nodes.public.js'
import publicApiIdentity from './identity/identity.public.js'
import privateApiIdentity from './identity/identity.private.js'

export async function initApi(ctx: AppContext) {
	ctx.api.public = initPublicApi(ctx)
	ctx.api.private = initPrivateApi(ctx)
}

export function stopApi(ctx: AppContext) {
	info(ctx, 'api', 'closing api servers')
	ctx.api?.public?.close()
	ctx.api?.private?.close()
}

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
