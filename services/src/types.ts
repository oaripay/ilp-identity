import type { Logger } from 'pino'
import type Database from 'better-sqlite3'
import type { Resolver } from 'did-resolver'

export type DID = `did:${string}:${string}`
export type IdentityStatus = 'active' | 'revoked'
export type JsonObject = Record<string, unknown>

export type LegalInformation = JsonObject

export type IdentityRecord = {
	did: DID
	status: IdentityStatus
	legalInformation: LegalInformation
	licenseId: string | null
	license: string | null
}

export type IdentityStatusView = Pick<IdentityRecord, 'licenseId' | 'status'>

export type ChallengeRecord = {
	did: DID
	nonce: string
	expiresAt: number
}

export type LicenseClaims = {
	jti: string
	sub: DID
	iss: string
	iat: number
	exp: number
	status: IdentityStatus
	legalInformation: LegalInformation
}

export type AppConfig = {
	dataDir: string
	logLevel: string
	api: {
		publicBind: string
		privateBind: string
	}
	db: {
		file: string
	}
	identity: {
		registry: string
		nonceTtlSeconds: number
		licenseTtlSeconds: number
		proofType: 'jwt'
	}
}

export type AppContext = {
	srcDir: string
	version: string
	logger: Logger
	config: AppConfig
	db: Database.Database
	api: {
		public?: { close: () => void }
		private?: { close: () => void }
	}
}
