import { z } from 'zod'
import { trace, warn } from '../log.ts'
import { UserError } from '../errors.ts'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { Context, ErrorHandler, MiddlewareHandler } from 'hono'
import type { AppContext } from '../types.ts'

export function parseBind(bind: string): { hostname: string; port: number } {
	const trimmed = bind.trim()
	const idx = trimmed.lastIndexOf(':')

	if (idx <= 0 || idx === trimmed.length - 1)
		throw new UserError(`invalid bind address "${bind}", expected "host:port"`)

	const hostname = trimmed.slice(0, idx)
	const port = Number(trimmed.slice(idx + 1))

	if (!Number.isInteger(port) || port < 1 || port > 65535)
		throw new UserError(`invalid port in bind address "${bind}"`)

	return { hostname, port }
}

export function formatValidatorError(target: string, error: { issues: Array<{ path?: PropertyKey[]; message: string }> }) {
	const issue = error.issues[0]
	const field = issue?.path?.[0]
	const fieldSuffix = typeof field === 'string' ? `"${field}"` : target

	return {
		message: `invalid ${fieldSuffix}: ${issue?.message ?? 'invalid value'}`,
	}
}

export function jsonValidator<T extends z.ZodTypeAny>(schema: T) {
	return (async (c, next) => {
		let payload: unknown

		try {
			payload = await c.req.json()
		} catch {
			return c.json({ message: 'invalid body: malformed JSON' }, 400)
		}

		const result = await schema.safeParseAsync(payload)

		if (!result.success)
			return c.json(formatValidatorError('body', result.error), 400)

		c.req.addValidatedData('json', result.data as {})

		return await next()
	}) as MiddlewareHandler<
		any,
		string,
		{
			in: { json: z.input<T> }
			out: { json: z.output<T> }
		}
	>
}

export function logRequestResponses(ctx: AppContext, moduleName: string): MiddlewareHandler {
	return async (c, next) => {
		const method = c.req.method
		const path = c.req.path
		const query = c.req.query()
		const info: string[] = []

		if (method !== 'GET' && method !== 'HEAD') {
			const body = await c.req.raw.clone().text()

			if (body)
				info.push(`body=${body}`)
		} else if (Object.keys(query).length > 0) {
			info.push(`query=${JSON.stringify(query)}`)
		}

		await next()

		if (c.res.status >= 400)
			warn(ctx, moduleName, `${method} ${path} ${c.res.status} ${info.join(' ')}`.trim())
		else
			trace(ctx, moduleName, `${method} ${path} ${c.res.status} ${info.join(' ')}`.trim())
	}
}

export function presentExposableErrors(_ctx: AppContext, _moduleName: string): ErrorHandler {
	return (error: Error, c: Context) => {
		const code = (error instanceof UserError ? error.status : 500) as ContentfulStatusCode
		const expose = error instanceof UserError ? error.expose : false
		const message = expose ? error.message : 'Internal Server Error'

		return c.json(
			{
				message: message.slice(0, 1).toUpperCase() + message.slice(1),
			},
			code,
		)
	}
}
