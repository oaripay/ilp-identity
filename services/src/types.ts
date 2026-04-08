import type { Logger } from 'pino'
import type { AppDatabase } from './db/init.ts'

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
}

export type AppContext = {
	version: string
	logger: Logger
	config: AppConfig
	db: AppDatabase
	api: {
		public?: { close: () => void }
		private?: { close: () => void }
	}
}
