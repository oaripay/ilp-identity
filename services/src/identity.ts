import { AppContext } from './types.js'
import { identities, challenges } from './db/schema.js'
import { and, eq, lte } from 'drizzle-orm'
import { verifyOpenId4VCI } from '@oari/ilp-identity'
import { HTTPException } from 'hono/http-exception'
import ilpLicense from '../ilp-license.json' with { type: 'json' }
import { hexTo32Bytes } from './utils.js'
import {
	createVerifiableCredentialJwt,
	EbsiVerifiableAttestation,
} from '@cef-ebsi/verifiable-credential'
import { ES256Signer } from 'did-jwt'
import fs from 'fs'

export async function initIssuer(ctx: AppContext) {
	const issuerWallet = JSON.parse(
		fs.readFileSync(ctx.config.identity.issuerWalletFile, 'utf-8'),
	)

	ctx.identity.issuer = {
		did: issuerWallet.did,
		alg: 'ES256',
		kid: issuerWallet.keys.ES256.kid as string,
		signer: ES256Signer(hexTo32Bytes(issuerWallet.keys.ES256.privateKeyHex)),
		accreditationId: issuerWallet.accreditationId,
	}
}

export async function createChallenge(ctx: AppContext, did: string) {
	const db = ctx.db!
	const [record] = await db
		.select()
		.from(identities)
		.where(eq(identities.did, did))

	if (!record) {
		throw new HTTPException(404, { message: `Identity not found for ${did}` })
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
		credential_issuer: ctx.identity.issuer!.did,
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
		throw new HTTPException(404, { message: `Identity not found for ${did}` })
	}

	if (record.status !== 'active') {
		throw new HTTPException(409, { message: `Identity ${did} is not active` })
	}
	const [, payload] = jwt.split('.')

	if (!payload) throw new HTTPException(401, { message: 'invalid proof jwt' })

	const parsed = JSON.parse(
		Buffer.from(payload, 'base64url').toString('utf8'),
	) as {
		nonce?: unknown
	}
	const nonce = parsed.nonce

	if (typeof nonce !== 'string')
		throw new HTTPException(400, { message: 'missing proof nonce' })

	const [challenge] = await db
		.select()
		.from(challenges)
		.where(and(eq(challenges.did, did), eq(challenges.nonce, nonce)))

	if (!challenge) {
		throw new HTTPException(404, {
			message: `Challenge not found or expired for ${did} and nonce ${nonce}`,
		})
	}

	try {
		await verifyOpenId4VCI(ctx.identity.resolver!, did, jwt, nonce)
	} catch (err) {
		throw new HTTPException(401, {
			message: `proof verification failed: ${err}`,
		})
	}

	await db
		.delete(challenges)
		.where(and(eq(challenges.did, record.did), eq(challenges.nonce, nonce)))

	const license = ilpLicense
	license.credentialSubject.id = did
	license.issuer = ctx.identity.issuer!.did
	license.issuanceDate = new Date().toISOString()
	license.issued = new Date().toISOString()
	license.expirationDate = new Date(
		Date.now() + ctx.config.identity.licenseTTL * 1000,
	).toISOString()
	license.termsOfUse.id = `${ctx.config.identity.ebsiEndpoint}/trusted-issuers-registry/v5/issuers/${ctx.identity.issuer!.did}/attributes/${ctx.identity.issuer!.accreditationId}`
	license.credentialSchema.id = `${ctx.config.identity.ebsiEndpoint}/trusted-schemas-registry/v3/schemas/${ilpLicense.credentialSchema.id}`

	const vc = await createVerifiableCredentialJwt(
		license as EbsiVerifiableAttestation,
		ctx.identity.issuer!,
		ctx.identity.ebsiConfig!,
	)

	const vcId = crypto.randomUUID()

	await db
		.update(identities)
		.set({ status: 'active', vcId, vc })
		.where(eq(identities.did, did))
		.returning({ did: identities.did })

	return vc
}

export async function getIdentityView(ctx: AppContext, did: string) {
	const db = ctx.db!

	const [identity] = await db
		.select()
		.from(identities)
		.where(eq(identities.did, did))

	if (!identity)
		throw new HTTPException(404, { message: `Identity not found for ${did}` })

	return identity
}
