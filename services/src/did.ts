import { Resolver } from 'did-resolver'
import { getResolver as getEbsiResolver } from '@cef-ebsi/ebsi-did-resolver'
import { getResolver as getKeyResolver } from '@cef-ebsi/key-did-resolver'
import { importJWK, jwtVerify, type JWK } from 'jose'
import { UserError } from './errors.ts'
import type { DID } from './types.ts'

export function initDidResolver(registry: string) {
	return new Resolver({
		...getEbsiResolver({
			registry: `${registry.replace(/\/$/, '')}/did-registry/v5/identifiers`,
		}),
		...getKeyResolver(),
	})
}

export async function resolveDidDocument(resolver: Resolver, did: DID) {
	const resolution = await resolver.resolve(did)

	if (!resolution.didDocument) {
		const error = resolution.didResolutionMetadata.error
		const message = resolution.didResolutionMetadata.message ?? `could not resolve DID ${did}`
		throw new UserError(message, { status: error === 'notFound' ? 404 : 400 })
	}

	return resolution.didDocument as DidDocument
}

export async function verifyDidProof(
	resolver: Resolver,
	did: DID,
	jwt: string,
	expectedAudience: string,
	expectedNonce: string,
) {
	const didDocument = await resolveDidDocument(resolver, did)
	const protectedHeader = parseProtectedHeader(jwt)

	if (protectedHeader.typ !== 'openid4vci-proof+jwt')
		throw new UserError('invalid proof header type', { status: 401 })

	const kid = protectedHeader.kid

	if (!kid || !kid.startsWith(`${did}#`))
		throw new UserError('invalid proof key identifier', { status: 401 })

	const method = findVerificationMethod(didDocument, kid)

	if (!method)
		throw new UserError('proof key not found in DID document', { status: 401 })

	const key = await importVerificationMethod(method, protectedHeader.alg)
	const verified = await jwtVerify(jwt, key, {
		audience: expectedAudience,
		issuer: did,
		typ: 'openid4vci-proof+jwt',
	})

	if (verified.payload.nonce !== expectedNonce)
		throw new UserError('invalid proof nonce', { status: 401 })

	return verified
}

type DidDocument = {
	id?: string
	verificationMethod?: VerificationMethod[]
	authentication?: Array<string | VerificationMethod>
	assertionMethod?: Array<string | VerificationMethod>
}

type VerificationMethod = {
	id: string
	type?: string
	controller?: string
	publicKeyJwk?: JWK
}

function parseProtectedHeader(jwt: string) {
	const [header] = jwt.split('.')

	if (!header)
		throw new UserError('invalid proof jwt', { status: 400 })

	return JSON.parse(Buffer.from(header, 'base64url').toString('utf8')) as {
		alg: string
		kid?: string
		typ?: string
	}
}

function findVerificationMethod(didDocument: DidDocument, kid: string) {
	const methods = [
		...(didDocument.verificationMethod ?? []),
		...collectEmbeddedMethods(didDocument.authentication),
		...collectEmbeddedMethods(didDocument.assertionMethod),
	]

	return methods.find(method => method.id === kid)
}

function collectEmbeddedMethods(items: Array<string | VerificationMethod> | undefined) {
	return (items ?? []).filter(item => typeof item !== 'string') as VerificationMethod[]
}

async function importVerificationMethod(method: VerificationMethod, alg: string) {
	if (!method.publicKeyJwk)
		throw new UserError('unsupported verification method', { status: 401 })

	return await importJWK(method.publicKeyJwk, alg)
}
