import pino from 'pino'
import type { AppConfig, AppContext } from './types'

export function initLogger(config: AppConfig) {
	return pino({
		level: config.logLevel,
		formatters: {
			level: (label) => ({ level: label.toUpperCase() }),
		},
		timestamp: () =>
			`,"time":"${new Date()
				.toISOString()
				.replace('T', ' ')
				.replace('Z', ' UTC')}"`,
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

export function trace(
	ctx: AppContext,
	module: string,
	message: string,
	info?: any,
) {
	if (info instanceof Error) ctx.logger.child({ module }).trace(info, message)
	else ctx.logger.trace({ module, ...info }, message)
}

export function info(
	ctx: AppContext,
	module: string,
	message: string,
	info?: any,
) {
	if (info instanceof Error) ctx.logger.child({ module }).info(info, message)
	else ctx.logger.info({ module, ...info }, message)
}

export function warn(
	ctx: AppContext,
	module: string,
	message: string,
	info?: any,
) {
	if (info instanceof Error) ctx.logger.child({ module }).warn(info, message)
	else ctx.logger.warn({ module, ...info }, message)
}

export function err(
	ctx: AppContext,
	module: string,
	message: string,
	info?: any,
) {
	if (info instanceof Error) ctx.logger.child({ module }).error(info, message)
	else ctx.logger.error({ module, ...info }, message)
}

export function fatal(
	ctx: AppContext,
	module: string,
	message: string,
	info?: any,
) {
	if (info instanceof Error) ctx.logger.child({ module }).fatal(info, message)
	else ctx.logger.fatal({ module, ...info }, message)
}
