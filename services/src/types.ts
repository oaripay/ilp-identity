import type { Logger } from 'pino'
import type { AppDatabase } from './db/init.ts'
import { Resolver } from 'did-resolver'
import type { EventEmitter } from 'node:events'
import {
	EbsiEnvConfiguration,
	EbsiIssuer,
} from '@cef-ebsi/verifiable-credential'

export type AppConfig = {
	api: {
		publicBind: string
		privateBind: string
	}
	logLevel: string
	dataDir: string
	db: {
		sqlite: {
			file: string
		}
	}
	identity: {
		ebsiEndpoint: string
		ilpSchemaId: string
		issuerWalletFile: string
		endpoint: string
		licenseTTL: number
		challengeTTL: number
	}
}

export type AppContext = {
	version: string
	logger: Logger
	config: AppConfig
	events: EventEmitter
	db?: AppDatabase
	identity: {
		resolver?: Resolver
		issuer?: EbsiIssuer & { accreditationId: string }
		ebsiConfig?: EbsiEnvConfiguration
	}
	api: {
		public?: { close: () => void }
		private?: { close: () => void }
	}
	exiting: boolean
}
