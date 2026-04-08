import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { info } from '../log.ts'
import { installPrivateApi } from './private.ts'
import { installPublicApi } from './public.ts'
import { logRequestResponses, parseBind, presentExposableErrors } from './utils.ts'
import type { AppContext } from '../types.ts'

export function initApi(ctx: AppContext) {
	if (ctx.config.api.publicBind === ctx.config.api.privateBind) {
		const app = new Hono()
		const { hostname, port } = parseBind(ctx.config.api.publicBind)

		app.use(logRequestResponses(ctx, 'api'))
		app.onError(presentExposableErrors(ctx, 'api'))
		app.get('/', c =>
			c.json({
				name: '@oari/ilp-identity-services',
				version: ctx.version,
			}),
		)

		installPublicApi(app, ctx)
		installPrivateApi(app, ctx)

		const server = serve({
			fetch: app.fetch,
			hostname,
			port,
		})

		ctx.api.public = server
		ctx.api.private = undefined

		info(ctx, 'api', `api listening on ${hostname}:${port}`)
		return
	}

	const publicApp = new Hono()
	const privateApp = new Hono()
	const publicBind = parseBind(ctx.config.api.publicBind)
	const privateBind = parseBind(ctx.config.api.privateBind)

	publicApp.use(logRequestResponses(ctx, 'api/public'))
	publicApp.onError(presentExposableErrors(ctx, 'api/public'))
	publicApp.get('/', c =>
		c.json({
			name: '@oari/ilp-identity-services',
			version: ctx.version,
		}),
	)
	installPublicApi(publicApp, ctx)

	privateApp.use(logRequestResponses(ctx, 'api/private'))
	privateApp.onError(presentExposableErrors(ctx, 'api/private'))
	privateApp.get('/', c =>
		c.json({
			name: '@oari/ilp-identity-services',
			version: ctx.version,
		}),
	)
	installPrivateApi(privateApp, ctx)

	ctx.api.public = serve({
		fetch: publicApp.fetch,
		hostname: publicBind.hostname,
		port: publicBind.port,
	})
	ctx.api.private = serve({
		fetch: privateApp.fetch,
		hostname: privateBind.hostname,
		port: privateBind.port,
	})

	info(ctx, 'api/public', `public api listening on ${publicBind.hostname}:${publicBind.port}`)
	info(ctx, 'api/private', `private api listening on ${privateBind.hostname}:${privateBind.port}`)
}

export function stopApi(ctx: AppContext) {
	info(ctx, 'api', 'closing api servers')
	ctx.api.public?.close()
	if (ctx.api.private && ctx.api.private !== ctx.api.public)
		ctx.api.private.close()
}
