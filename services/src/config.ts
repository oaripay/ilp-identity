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
		ebsi: {
			endpoint: envString('EBSI_DOMAIN', 'https://ebsi.oari.io'),
			ilpSchemaId: envString(
				'EBSI_ILP_SCHEMA_ID',
				'z4DDAmb38YoKBwT1WPBwxdczBAR4Keqxgwk3qksupjAts',
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
