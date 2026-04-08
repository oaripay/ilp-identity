import minimist from 'minimist'
import { UserError } from './errors.ts'
import type { AppConfig } from './types.ts'

export function configFromEnv(argv: string[] = process.argv.slice(2)): AppConfig {
	const args = minimist(argv)

	return {
		logLevel: envString('LOG_LEVEL', 'info'),
		api: {
			publicBind: envString(
				'API_PUBLIC_BIND',
				'0.0.0.0:4080',
			),
			privateBind: envString(
				'API_PRIVATE_BIND',
				'0.0.0.0:4070',
			),
		},
		db: {
			file: envString('DB_FILE', args.db ?? 'registry.db'),
		},
		identity: {
			registry: envString('IDENTITY_REGISTRY', 'https://ebsi.oari.io'),
			nonceTtlSeconds: envInt('IDENTITY_NONCE_TTL_SECONDS', 300),
			licenseTtlSeconds: envInt('IDENTITY_LICENSE_TTL_SECONDS', 60 * 60 * 24 * 365),
			proofType: 'jwt',
		},
	}
}

function envString(name: string, defaultValue?: string): string {
	const envValue = process.env[name]?.trim()

	if (envValue)
		return envValue

	if (defaultValue !== undefined)
		return defaultValue

	throw new UserError(`environment variable ${name} must be set`)
}

function envInt(name: string, defaultValue: number): number {
	const envValue = process.env[name]?.trim()

	if (!envValue)
		return defaultValue

	const value = Number(envValue)

	if (!Number.isInteger(value))
		throw new UserError(`environment variable ${name} must be an integer`)

	return value
}

function envIntArg(value: unknown): number | undefined {
	if (value == null)
		return undefined

	const parsed = Number(value)

	if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535)
		throw new UserError('argument --port must be an integer between 1 and 65535')

	return parsed
}

function inferIssuerFromBind(bind: string): string {
	const trimmed = bind.trim()
	const idx = trimmed.lastIndexOf(':')

	if (idx <= 0)
		return 'http://127.0.0.1:4080'

	const host = trimmed.slice(0, idx)
	const port = trimmed.slice(idx + 1)
	const hostname = host === '0.0.0.0' ? '127.0.0.1' : host

	return `http://${hostname}:${port}`
}
