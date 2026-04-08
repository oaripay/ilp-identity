import type { Logger } from 'pino'
import type { AppDatabase } from './db/init.ts'
import { Resolver } from 'did-resolver'
import type { EventEmitter } from 'node:events'
import { EbsiEnvConfiguration } from '@cef-ebsi/verifiable-credential'

export type AppConfig = {
	api: {
		public: string
		private: string
	}
	logLevel: string
	dataDir: string
	db: {
		sqlite: {
			file: string
		}
	}
	ebsi: {
		endpoint: string
		ilpSchemaId: string
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
		config?: EbsiEnvConfiguration
	}
	api: {
		public?: { close: () => void }
		private?: { close: () => void }
	}
	exiting: boolean
}
