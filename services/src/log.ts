import pino from 'pino'
import type { AppConfig, AppContext } from './types.ts'

export function initLogger(config: AppConfig) {
	return pino({
		level: config.logLevel,
		formatters: {
			level: label => ({ level: label.toUpperCase() }),
		},
		timestamp: () => `,"time":"${new Date().toISOString().replace('T', ' ').replace('Z', ' UTC')}"`,
		transport: {
			target: 'pino-pretty',
			options: {
				colorize: false,
				ignore: 'pid,hostname,time,level,module',
				messageFormat: '{time} {level} [{module}] {msg}',
			},
		},
	})
}

export function trace(ctx: AppContext, module: string, message: string, info?: unknown) {
	log(ctx, 'trace', module, message, info)
}

export function info(ctx: AppContext, module: string, message: string, info?: unknown) {
	log(ctx, 'info', module, message, info)
}

export function warn(ctx: AppContext, module: string, message: string, info?: unknown) {
	log(ctx, 'warn', module, message, info)
}

export function err(ctx: AppContext, module: string, message: string, info?: unknown) {
	log(ctx, 'error', module, message, info)
}

function log(
	ctx: AppContext,
	level: 'trace' | 'info' | 'warn' | 'error',
	module: string,
	message: string,
	info?: unknown,
) {
	if (info instanceof Error)
		ctx.logger.child({ module })[level](info, message)
	else if (info && typeof info === 'object')
		ctx.logger[level]({ module, ...(info as Record<string, unknown>) }, message)
	else
		ctx.logger[level]({ module }, message)
}
