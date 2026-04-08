import { randomUUID } from 'node:crypto'
import { SignJWT, importPKCS8 } from 'jose'
import { consumeChallenge, getIdentity, getIdentityStatus, listIdentities, putChallenge, putIdentity, purgeExpiredChallenges, updateLicense, deleteIdentity as deleteIdentityRow } from './db/storage.ts'
import { verifyDidProof } from './did.ts'
import { UserError } from './errors.ts'
import type { AppContext, DID, IdentityRecord, IdentityStatus, LegalInformation } from './types.ts'

const LICENSE_SIGNING_KEY = [
	'-----BEGIN PRIVATE KEY-----',
	'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgGq5WxM9wE8Ql8l0K',
	'jM6vmpfQdW7m/0C8h4V1S2MXFfOhRANCAAR+Xa0lwqj4r5NSl7+Z6nC9WQk0h0k3',
	'7M+lnU8lu7t5n0rjW7Dgbm0S4DljmFJqD8XWmP3Sg7E8YxY6k7Qv7x2Y',
	'-----END PRIVATE KEY-----',
].join('\n')

let cachedLicenseKey: Awaited<ReturnType<typeof importPKCS8>> | undefined

export function createChallenge(ctx: AppContext, did: DID) {
	const record = getIdentity(ctx.db, did)

	if (!record)
		throw new UserError(`unknown DID ${did}`, { status: 404 })

	const expiresAt = Date.now() + ctx.config.identity.nonceTtlSeconds * 1000
	const nonce = randomUUID()

	purgeExpiredChallenges(ctx.db, Date.now())
	putChallenge(ctx.db, { did, nonce, expiresAt })

	return {
		did,
		status: record.status,
		credential_issuer: ctx.config.identity.issuer,
		credential_endpoint: `${ctx.config.identity.issuer.replace(/\/$/, '')}/identity/${encodeURIComponent(did)}/issue`,
		c_nonce: nonce,
		c_nonce_expires_in: ctx.config.identity.nonceTtlSeconds,
		proof_types_supported: {
			jwt: {
				proof_signing_alg_values_supported: ['ES256', 'EdDSA'],
				typ: 'openid4vci-proof+jwt',
			},
		},
	}
}

export async function issueLicense(ctx: AppContext, did: DID, jwt: string) {
	const record = getIdentity(ctx.db, did)

	if (!record)
		throw new UserError(`unknown DID ${did}`, { status: 404 })

	if (record.status === 'revoked')
		throw new UserError(`DID ${did} is revoked`, { status: 409 })

	const proof = await verifyDidProof(
		ctx.resolver,
		did,
		jwt,
		ctx.config.identity.issuer,
		readNonceClaim(jwt),
	)
	void proof

	const nonce = readNonceClaim(jwt)
	const valid = consumeChallenge(ctx.db, did, nonce, Date.now())

	if (!valid)
		throw new UserError('invalid or expired challenge', { status: 401 })

	const licenseId = `lic_${randomUUID().replaceAll('-', '')}`
	const license = await signLicense(ctx, record, licenseId)
	const updated = updateLicense(ctx.db, did, licenseId, license)

	return {
		licenseId: updated.licenseId,
		status: updated.status,
		license,
	}
}

export function getIdentityView(ctx: AppContext, did: DID) {
	const record = getIdentityStatus(ctx.db, did)

	if (!record)
		throw new UserError(`unknown DID ${did}`, { status: 404 })

	return record
}

export function getTrustedIdentities(ctx: AppContext) {
	return listIdentities(ctx.db)
}

export function putTrustedIdentity(
	ctx: AppContext,
	did: DID,
	status: IdentityStatus,
	legalInformation: LegalInformation,
) {
	return putIdentity(ctx.db, did, status, legalInformation)
}

export function deleteTrustedIdentity(ctx: AppContext, did: DID) {
	return deleteIdentityRow(ctx.db, did)
}

async function signLicense(ctx: AppContext, record: IdentityRecord, licenseId: string) {
	const now = Math.floor(Date.now() / 1000)
	const key = cachedLicenseKey ??= await importPKCS8(LICENSE_SIGNING_KEY, 'ES256')

	return await new SignJWT({
		jti: licenseId,
		sub: record.did,
		status: record.status,
		legalInformation: record.legalInformation,
	})
		.setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
		.setIssuer(ctx.config.identity.issuer)
		.setIssuedAt(now)
		.setExpirationTime(now + ctx.config.identity.licenseTtlSeconds)
		.sign(key)
}

function readNonceClaim(jwt: string) {
	const [, payload] = jwt.split('.')

	if (!payload)
		throw new UserError('invalid proof jwt', { status: 400 })

	const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
		nonce?: unknown
	}

	if (typeof parsed.nonce !== 'string' || parsed.nonce.length === 0)
		throw new UserError('missing proof nonce', { status: 400 })

	return parsed.nonce
}
