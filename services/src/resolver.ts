import { AppContext } from './types.js'
import { DIDDocument, Resolver } from 'did-resolver'
import { getResolver } from '@cef-ebsi/ebsi-did-resolver'
import { Identity, challenges } from './db/schema.js'
import {
	EbsiVerifiablePresentation,
	verifyPresentationJwt,
} from '@cef-ebsi/verifiable-presentation'
import {
	EbsiEnvConfiguration,
	EbsiVerifiableAttestation,
	verifyCredentialJwt,
} from '@cef-ebsi/verifiable-credential'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import {
	compactVerify,
	decodeProtectedHeader,
	importJWK,
	jwtVerify,
	type JWK,
} from 'jose'

function first<T>(value: T | T[] | undefined | null): T | undefined {
	if (!value) return undefined
	return Array.isArray(value) ? value[0] : value
}

function ensureString(value: unknown, message: string): string {
	if (typeof value !== 'string' || value.length === 0) throw new Error(message)
	return value
}

function extractVcJwtFromVp(verifiedVp: EbsiVerifiablePresentation): string {
	const vc = first(verifiedVp.verifiableCredential)

	if (typeof vc === 'string') return vc

	if (vc && typeof vc === 'object') {
		const maybeJwt = vc.jwt
		if (typeof maybeJwt === 'string') return maybeJwt
		throw new Error('VP contains a VC object; expected VC JWT string')
	}

	throw new Error('VP has no verifiableCredential')
}

function getCredentialSubjectDid(
	verifiedVc: EbsiVerifiableAttestation,
): string {
	const cs = verifiedVc.credentialSubject

	const subject = Array.isArray(cs) ? cs[0] : cs
	const subjectDid = subject.id

	return ensureString(
		subjectDid,
		'VC credentialSubject.id is missing or not a string',
	)
}

function getPublicKeyJwkFromDidDocument(
	didDocument: DIDDocument,
	kid: string,
): JWK {
	const verificationMethods = Array.isArray(didDocument.verificationMethod)
		? didDocument.verificationMethod
		: [didDocument.verificationMethod]

	const byId = (id: string) =>
		verificationMethods.find((vm) => vm && vm.id === id)

	const method = verificationMethods.find((vm) => vm && vm.id == kid)

	if (!method) {
		throw new Error(
			`No suitable verificationMethod found in DID document (kid: ${kid ?? 'none'})`,
		)
	}

	const jwk = method.publicKeyJwk

	if (!jwk || typeof jwk !== 'object') {
		throw new Error(
			'Selected DID verificationMethod does not contain publicKeyJwk',
		)
	}

	return jwk as JWK
}

function getCredentialSchemaId(verifiedVc: EbsiVerifiableAttestation): string {
	const cs = first(verifiedVc.credentialSchema)

	const schemaIdOrUrl =
		typeof cs === 'string'
			? cs
			: cs && typeof cs === 'object'
				? cs.id
				: undefined

	const schemaUrl = ensureString(schemaIdOrUrl, 'VC has no credentialSchema.id')

	const schemaId = schemaUrl.split('/').at(-1)
	if (!schemaId) throw new Error(`Invalid credentialSchema.id: ${schemaUrl}`)

	return schemaId
}

function getIssuerDid(verifiedVc: EbsiVerifiableAttestation): string {
	const issuer = verifiedVc.issuer
	if (typeof issuer === 'string') return issuer
	if (issuer && typeof issuer === 'object') {
		const id = issuer.id
		return ensureString(id, 'VC issuer is missing or not a string')
	}
	throw new Error('VC issuer is missing or not a string')
}

function getRegistryEndpointFromDidDocument(
	didDocument: DIDDocument,
	issuer: string,
): string {
	const services = didDocument.service
	if (!Array.isArray(services)) {
		throw new Error(
			`Unable to find services in DID document for issuer ${issuer}`,
		)
	}

	for (const service of services) {
		if (
			service &&
			typeof service === 'object' &&
			service.type === 'InterledgerIdentityProviderV1'
		) {
			const endpoint = first(service.serviceEndpoint)
			if (typeof endpoint === 'string' && endpoint.length > 0) return endpoint
		}
	}

	throw new Error(
		"Issuer's DID document does not contain an InterledgerIdentityProviderV1 service",
	)
}

async function fetchAndValidateIdentity(
	registryEndpoint: string,
	subjectDid: string,
): Promise<Identity> {
	const url = `${registryEndpoint}/identity/${encodeURIComponent(subjectDid)}`
	const response = await fetch(url)

	if (!response.ok) {
		throw new Error(
			`Failed to fetch subject's identity from registry: ${response.status} ${response.statusText}`,
		)
	}

	const data = await response.json()
	const validated = z.custom<Identity>().safeParse(data)

	if (!validated.success) {
		throw new Error(
			'Invalid response from identity registry: ' +
				JSON.stringify(validated.error),
		)
	}
	return validated.data
}

export function initResolver(ctx: AppContext) {
	const resolverConfig = {
		registry: `${ctx.config.identity.ebsiEndpoint}/did-registry/v5/identifiers`,
	}

	const ebsiResolver = getResolver(resolverConfig)
	const didResolver = new Resolver(ebsiResolver)

	const config = {
		hosts: [ctx.config.identity.ebsiEndpoint],
		scheme: 'ebsi',
		network: {
			name: 'pilot',
			isOptional: false,
		},
		services: {
			'did-registry': 'v5',
			'trusted-issuers-registry': 'v5',
			'trusted-policies-registry': 'v3',
			'trusted-schemas-registry': 'v3',
		},
	} as const satisfies EbsiEnvConfiguration

	ctx.identity.resolver = didResolver
	ctx.identity.config = config
}

export async function verifyVp(
	ctx: AppContext,
	vpJwt: string,
): Promise<string> {
	const config = ctx.identity.config
	if (!config) throw new Error('Identity config is not initialised')

	const verifiedVp = await verifyPresentationJwt(
		vpJwt,
		ctx.config.identity.issuer.did,
		config,
	)

	const vcJwt = extractVcJwtFromVp(verifiedVp)

	return await verifyVc(ctx, vcJwt)
}

export async function verifyVc(
	ctx: AppContext,
	vcJwt: string,
): Promise<string> {
	const config = ctx.identity.config
	if (!config) throw new Error('Identity config is not initialised')

	const resolver = ctx.identity.resolver
	if (!resolver) throw new Error('DID resolver is not initialised')

	const verifiedVc = await verifyCredentialJwt(vcJwt, config)

	const subjectDid = getCredentialSubjectDid(verifiedVc)
	const schemaId = getCredentialSchemaId(verifiedVc)
	const issuer = getIssuerDid(verifiedVc)

	if (schemaId !== ctx.config.identity.ilpSchemaId) {
		throw new Error(`Not ilp schema credential schema: ${schemaId}`)
	}

	const resolution = await resolver.resolve(issuer)
	const didDocument = resolution.didDocument

	if (!didDocument) {
		throw new Error(`Unable to resolve DID document for issuer ${issuer}`)
	}

	const registryEndpoint = getRegistryEndpointFromDidDocument(
		didDocument,
		issuer,
	)

	const identity = await fetchAndValidateIdentity(registryEndpoint, subjectDid)

	if (identity.status !== 'active') {
		throw new Error(`Subject's ILP license is not active: ${identity.status}`)
	}

	return subjectDid
}

export async function verifyOpenId4VCI(
	ctx: AppContext,
	did: string,
	jwt: string,
	nonce: string,
): Promise<void> {
	const db = ctx.db!
	const resolver = ctx.identity.resolver!

	const [challenge] = await db
		.select()
		.from(challenges)
		.where(and(eq(challenges.did, did), eq(challenges.nonce, nonce)))

	if (!challenge) {
		throw new Error(
			`Challenge not found or expired for ${did} and nonce ${nonce}`,
		)
	}

	const resolution = await resolver.resolve(did)
	const didDocument = resolution.didDocument

	if (!didDocument) {
		throw new Error(`Unable to resolve DID document fo ${did}`)
	}

	const protectedHeader = decodeProtectedHeader(jwt)

	if (protectedHeader.typ !== 'openid4vci-proof+jwt') {
		throw new Error(
			`Invalid OpenID4VCI proof JWT typ: ${String(protectedHeader.typ)}`,
		)
	}

	const alg = ensureString(
		protectedHeader.alg,
		'OpenID4VCI proof JWT header.alg is missing or not a string',
	)

	if (!['ES256K', 'ES256'].includes(alg)) {
		throw new Error(`Unsupported OpenID4VCI proof JWT alg: ${alg}`)
	}

	const kid = protectedHeader.kid

	if (!kid) {
		throw new Error('OpenID4VCI proof JWT header.kid is missing')
	}

	const jwk = getPublicKeyJwkFromDidDocument(didDocument, kid)
	const key = await importJWK(jwk, alg)

	try {
		await jwtVerify(jwt, key, {
			audience: ctx.config.identity.issuer.did,
			issuer: did,
			typ: 'openid4vci-proof+jwt',
		})
	} catch (e) {
		throw new Error(`Invalid OpenID4VCI proof JWT: ${e}`)
	}
}
