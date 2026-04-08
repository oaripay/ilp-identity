import type Database from 'better-sqlite3'
import type {
	ChallengeRecord,
	DID,
	IdentityRecord,
	IdentityStatus,
	IdentityStatusView,
	LegalInformation,
} from '../types.ts'

export function listIdentities(db: Database.Database): IdentityRecord[] {
	const rows = db
		.prepare<[], IdentityRow>('SELECT * FROM identities ORDER BY did ASC')
		.all()

	return rows.map(mapIdentityRow)
}

export function getIdentity(db: Database.Database, did: DID): IdentityRecord | undefined {
	const row = db
		.prepare<[string], IdentityRow>('SELECT * FROM identities WHERE did = ?')
		.get(did)

	return row ? mapIdentityRow(row) : undefined
}

export function getIdentityStatus(db: Database.Database, did: DID): IdentityStatusView | undefined {
	const row = db
		.prepare<[string], Pick<IdentityRow, 'status' | 'license_id'>>(
			'SELECT status, license_id FROM identities WHERE did = ?',
		)
		.get(did)

	if (!row)
		return undefined

	return {
		status: row.status,
		licenseId: row.license_id,
	}
}

export function putIdentity(
	db: Database.Database,
	did: DID,
	status: IdentityStatus,
	legalInformation: LegalInformation,
): IdentityRecord {
	db.prepare(
		`INSERT INTO identities (did, status, legal_information)
		 VALUES (?, ?, ?)
		 ON CONFLICT(did) DO UPDATE SET
			status = excluded.status,
			legal_information = excluded.legal_information`,
	).run(did, status, JSON.stringify(legalInformation))

	return getIdentity(db, did) as IdentityRecord
}

export function deleteIdentity(db: Database.Database, did: DID): boolean {
	const result = db
		.prepare('DELETE FROM identities WHERE did = ?')
		.run(did)

	return result.changes > 0
}

export function putChallenge(db: Database.Database, challenge: ChallengeRecord) {
	db.prepare(
		`INSERT INTO challenges (did, nonce, expires_at)
		 VALUES (?, ?, ?)
		 ON CONFLICT(did) DO UPDATE SET
			nonce = excluded.nonce,
			expires_at = excluded.expires_at`,
	).run(challenge.did, challenge.nonce, challenge.expiresAt)
}

export function consumeChallenge(
	db: Database.Database,
	did: DID,
	nonce: string,
	now: number,
): boolean {
	const tx = db.transaction(() => {
		const current = db
			.prepare<[string], ChallengeRow>('SELECT * FROM challenges WHERE did = ?')
			.get(did)

		if (!current)
			return false

		if (current.nonce !== nonce || current.expires_at < now)
			return false

		db.prepare('DELETE FROM challenges WHERE did = ?').run(did)
		return true
	})

	return tx()
}

export function purgeExpiredChallenges(db: Database.Database, now: number) {
	db.prepare('DELETE FROM challenges WHERE expires_at < ?').run(now)
}

export function updateLicense(
	db: Database.Database,
	did: DID,
	licenseId: string,
	license: string,
): IdentityRecord {
	db.prepare(
		'UPDATE identities SET license_id = ?, license = ? WHERE did = ?',
	).run(licenseId, license, did)

	return getIdentity(db, did) as IdentityRecord
}

export function getNodes(db: Database.Database): string[] {
	const row = db
		.prepare<[], { urls: string }>('SELECT urls FROM nodes WHERE id = 1')
		.get()

	if (!row)
		return []

	return JSON.parse(row.urls) as string[]
}

export function putNodes(db: Database.Database, urls: string[]): string[] {
	db.prepare(
		`INSERT INTO nodes (id, urls)
		 VALUES (1, ?)
		 ON CONFLICT(id) DO UPDATE SET
			urls = excluded.urls`,
	).run(JSON.stringify(urls))

	return getNodes(db)
}

type IdentityRow = {
	did: DID
	status: IdentityStatus
	legal_information: string
	license_id: string | null
	license: string | null
}

type ChallengeRow = {
	did: DID
	nonce: string
	expires_at: number
}

function mapIdentityRow(row: IdentityRow): IdentityRecord {
	return {
		did: row.did,
		status: row.status,
		legalInformation: JSON.parse(row.legal_information) as LegalInformation,
		licenseId: row.license_id,
		license: row.license,
	}
}
