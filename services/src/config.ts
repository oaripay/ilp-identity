import { AppConfig } from './types.js'

export function configFromEnv(): AppConfig {
	return {
		logLevel: envString('LOG_LEVEL', 'info'),
		dataDir: envString('DATA_DIR', '/opt/data'),
		api: {
			public: envString('API_PRIVATE', '0.0.0.0:3000'),
			private: envString('API_PUBLIC', '0.0.0.0:3001'),
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
			issuer: envString('ISSUER_DID', 'did:ebsi:z24Ux5CqJvPGoGmwF6ETPaoy'),
			endpoint: envString('IDENTITY_ENDPOINT', 'http://0.0.0.0:3000/identity'),
			licenseTTL: parseInt(envString('LICENSE_TTL_SECONDS', `${60 * 60 * 24}`)),
			challengeTTL: parseInt(
				envString('CHALLANGE_TTL_SECONDS', `${60 * 60 * 1}`),
			),
		},
	}
}

function envString(name: string, defaultValue?: string | null): string {
	const envValue = process.env[name]

	if (envValue) return envValue
	if (defaultValue) return defaultValue

	throw new Error(`Environment variable ${name} must be set.`)
}
