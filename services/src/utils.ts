import { AppContext } from './types.js'
import { type MiddlewareHandler } from 'hono'
import { warn, trace } from './logger.js'

export function parseBind(bind: string): { hostname: string; port: number } {
	const trimmed = bind.trim()
	const idx = trimmed.lastIndexOf(':')

	if (idx <= 0 || idx === trimmed.length - 1)
		throw new Error(`invalid bind address "${bind}", expected "host:port"`)

	const hostname = trimmed.slice(0, idx)
	const portText = trimmed.slice(idx + 1)
	const port = Number(portText)

	if (!Number.isInteger(port) || port < 1 || port > 65535)
		throw new Error(`invalid port in bind address "${bind}"`)

	return { hostname, port }
}

export function logRequestResponses(
	ctx: AppContext,
	moduleName: string,
): MiddlewareHandler {
	return async (c, next) => {
		let method = c.req.method
		let path = c.req.path
		let query = c.req.query()
		let info = []

		if (method !== 'GET') {
			info.push(`body=${JSON.stringify(await c.req.raw.clone().json())}`)
		} else {
			if (Object.keys(query).length > 0)
				info.push(`query=${JSON.stringify(query)}`)
		}

		await next()

		if (c.res.status >= 400)
			warn(
				ctx,
				moduleName,
				`${method} ${path} ${c.res.status} ${info.join(' ')}`,
			)
		else
			trace(
				ctx,
				moduleName,
				`${method} ${path} ${c.res.status} ${info.join(' ')}`,
			)
	}
}

export function hexTo32Bytes(privateKeyHex: string): Uint8Array {
	const hex = privateKeyHex.startsWith('0x')
		? privateKeyHex.slice(2)
		: privateKeyHex

	if (hex.length !== 64) {
		throw new Error(
			`Expected 32-byte key (64 hex chars), got ${hex.length} hex chars`,
		)
	}

	return Uint8Array.from(Buffer.from(hex, 'hex'))
}
