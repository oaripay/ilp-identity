import { EventEmitter } from 'node:events'
import { AppContext } from './types.js'
import { initPublicApi } from './public.js'
import { initPrivateApi } from './private.js'
import { initDatabase } from './db/init.js'
import { configFromEnv } from './config.js'
import { initLogger, info } from './logger.js'
import { initResolver } from './resolver.js'

async function initApi(ctx: AppContext) {
	ctx.api.public = initPublicApi(ctx)
	ctx.api.private = initPrivateApi(ctx)
}

export function stopApi(ctx: AppContext) {
	info(ctx, 'api', 'closing api servers')
	ctx.api?.public?.close()
	ctx.api?.private?.close()
}

const config = configFromEnv()

const ctx: AppContext = {
	version: '0.0.1',
	logger: initLogger(config),
	config,
	events: new EventEmitter(),
	identity: {},
	api: {},
	exiting: false,
}

await initDatabase(ctx)
await initApi(ctx)
await initResolver(ctx)

process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))
process.once('SIGHUP', () => void shutdown('SIGHUP'))

async function shutdown(signal: string) {
	if (ctx.exiting) return

	ctx.exiting = true

	if (signal) info(ctx, 'init', `received ${signal}, shutting down`)

	await Promise.allSettled([stopApi(ctx)])

	process.exit(0)
}
