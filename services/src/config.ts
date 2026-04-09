import { AppConfig } from './types.js'

export function configFromEnv(): AppConfig {
	return {
		logLevel: envString('LOG_LEVEL', 'trace'),
		dataDir: envString('DATA_DIR', './data'),
		api: {
			publicBind: envString('API_PUBLIC_BIND', '0.0.0.0:3000'),
			privateBind: envString('API_PRIVATE_BIND', '0.0.0.0:3001'),
		},
		db: {
			sqlite: {
				file: envString('DB_SQLITE_FILE', 'registry.db'),
			},
		},
		identity: {
			ebsiEndpoint: envString('EBSI_DOMAIN', 'https://ebsi.oari.io'),
			ilpSchemaId: envString(
				'EBSI_ILP_SCHEMA_ID',
				'z4DDAmb38YoKBwT1WPBwxdczBAR4Keqxgwk3qksupjAts',
			),
			issuerWalletFile: envString('ISSUER_WALLET_FILE', './root.wallet.json'),
			endpoint: envString('IDENTITY_ENDPOINT', 'http://0.0.0.0:3000/identity'),
			licenseTTL: parseInt(envString('LICENSE_TTL_SECONDS', `${60 * 60 * 24}`)),
			challengeTTL: parseInt(envString('CHALLANGE_TTL_SECONDS', `${60 * 3}`)),
		},
	}
}

function envString(name: string, defaultValue?: string | null): string {
	const envValue = process.env[name]

	if (envValue) return envValue
	if (defaultValue) return defaultValue

	throw new Error(`Environment variable ${name} must be set.`)
}
