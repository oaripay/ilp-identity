import { DIDDocument, Resolver } from 'did-resolver'
import { decodeProtectedHeader, importJWK, jwtVerify, type JWK } from 'jose'
import { ValidationError } from './errors.js'
import { ensureString } from './utils.js'
import { createJWT, Signer } from 'did-jwt'
import { OpenID4VCIChallengePayload } from './types.js'

function getPublicKeyJwkFromDidDocument(
	didDocument: DIDDocument,
	kid: string,
): JWK {
	const verificationMethods = Array.isArray(didDocument.verificationMethod)
		? didDocument.verificationMethod
		: [didDocument.verificationMethod]

	const method = verificationMethods.find((vm) => vm && vm.id == kid)

	if (!method) {
		throw new ValidationError(
			`No suitable verificationMethod found in DID document (kid: ${kid ?? 'none'})`,
		)
	}

	const jwk = method.publicKeyJwk

	if (!jwk || typeof jwk !== 'object') {
		throw new ValidationError(
			'Selected DID verificationMethod does not contain publicKeyJwk',
		)
	}

	return jwk as JWK
}

export async function verifyOpenId4VCI(
	resolver: Resolver,
	did: string,
	audience: string,
	jwt: string,
): Promise<void> {
	const resolution = await resolver.resolve(did)
	const didDocument = resolution.didDocument

	if (!didDocument) {
		throw new ValidationError(`Unable to resolve DID document fo ${did}`)
	}

	const protectedHeader = decodeProtectedHeader(jwt)

	if (
		protectedHeader.typ !== 'openid4vci-proof+jwt' &&
		protectedHeader.typ !== 'JWT'
	) {
		throw new ValidationError(
			`Invalid OpenID4VCI proof JWT typ: ${String(protectedHeader.typ)}`,
		)
	}

	const alg = ensureString(
		protectedHeader.alg,
		'OpenID4VCI proof JWT header.alg is missing or not a string',
	)

	if (!['ES256K', 'ES256'].includes(alg)) {
		throw new ValidationError(`Unsupported OpenID4VCI proof JWT alg: ${alg}`)
	}

	const kid = protectedHeader.kid

	if (!kid) {
		throw new ValidationError('OpenID4VCI proof JWT header.kid is missing')
	}

	const jwk = getPublicKeyJwkFromDidDocument(didDocument, kid)
	const key = await importJWK(jwk, alg)

	try {
		await jwtVerify(jwt, key, {
			audience,
			issuer: did,
			typ: 'JWT',
		})
	} catch (e) {
		throw new ValidationError(`Invalid OpenID4VCI proof JWT: ${e}`)
	}
}

export async function signOpenId4Vci(
	challengePayload: OpenID4VCIChallengePayload,
	holderDid: string,
	audience: string,
	signer: Signer,
	alg: string,
	kid: string,
	expiresIn: number = 300,
): Promise<string> {
	return await createJWT(
		{ ...challengePayload, aud: audience },
		{
			issuer: holderDid,
			signer,
			alg,
			expiresIn,
		},
		{
			kid,
			typ: 'JWT',
		},
	)
}
