import { AppContext } from './types.js'
import { identities, challenges } from './db/schema.js'
import { and, eq, lte } from 'drizzle-orm'
import { verifyOpenId4VCI } from './resolver.js'
import ilpLicense from '../ilp-license.json' with { type: 'json' }
import {
	createVerifiableCredentialJwt,
	EbsiVerifiableAttestation,
} from '@cef-ebsi/verifiable-credential'

export async function createChallenge(ctx: AppContext, did: string) {
	const db = ctx.db!
	const [record] = await db
		.select()
		.from(identities)
		.where(eq(identities.did, did))

	if (!record) {
		throw new Error(`Identity not found for ${did}`)
	}

	await db
		.delete(challenges)
		.where(
			and(
				eq(challenges.did, record.did),
				lte(challenges.createdAt, Date.now()),
			),
		)

	const challenge = {
		did: record.did,
		nonce: crypto.randomUUID(),
		createdAt: Date.now(),
		expiresAt: Date.now() + ctx.config.identity.challengeTTL * 1000,
	}

	await db.insert(challenges).values(challenge)

	return {
		did: record.did,
		status: record.status,
		credential_issuer: ctx.config.identity.issuer.did,
		credential_endpoint: `${ctx.config.identity.endpoint}/${encodeURIComponent(did)}/issue`,
		c_nonce: challenge.nonce,
		c_nonce_expires_in: ctx.config.identity.challengeTTL,
		proof_types_supported: {
			jwt: {
				proof_signing_alg_values_supported: ['ES256', 'ES256K'],
				typ: 'openid4vci-proof+jwt',
			},
		},
	}
}

export async function issueLicense(ctx: AppContext, did: string, jwt: string) {
	const db = ctx.db!
	const [record] = await db
		.select()
		.from(identities)
		.where(eq(identities.did, did))

	if (!record) {
		throw new Error(`Identity not found for ${did}`)
	}

	if (record.status !== 'active') {
		throw new Error(`Identity ${did} is not active`)
	}
	const [, payload] = jwt.split('.')

	if (!payload) throw new Error('invalid proof jwt')

	const parsed = JSON.parse(
		Buffer.from(payload, 'base64url').toString('utf8'),
	) as {
		nonce?: unknown
	}
	const nonce = parsed.nonce

	if (typeof nonce !== 'string') throw new Error('missing proof nonce')

	await verifyOpenId4VCI(ctx, did, jwt, nonce)

	await db
		.delete(challenges)
		.where(and(eq(challenges.did, record.did), eq(challenges.nonce, nonce)))

	const license = ilpLicense
	license.credentialSubject.id = did
	license.issuer = ctx.config.identity.issuer.did
	license.issuanceDate = new Date().toISOString()
	license.issued = new Date().toISOString()
	license.expirationDate = new Date(
		Date.now() + ctx.config.identity.licenseTTL * 1000,
	).toISOString()
	//license.termsOfUse.id = ctx.config.identity.issuer.accreditationUrl
	license.credentialSchema.id = `${ctx.config.identity.endpoint}/schemas/${ilpLicense.credentialSchema.id.split('/').at(-1)}`

	return await createVerifiableCredentialJwt(
		license as EbsiVerifiableAttestation,
		ctx.config.identity.issuer,
		ctx.identity.config!,
	)
}

export async function getIdentityView(ctx: AppContext, did: string) {
	const db = ctx.db!

	const [out] = await db
		.select()
		.from(identities)
		.where(eq(identities.did, did))

	return out
}
