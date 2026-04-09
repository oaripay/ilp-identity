import { AppContext } from './types.js'
import { DIDDocument, Resolver } from 'did-resolver'
import { getResolver } from '@cef-ebsi/ebsi-did-resolver'
import { Identity } from './db/schema.js'
import {
	EbsiVerifiablePresentation,
	verifyPresentationJwt,
} from '@cef-ebsi/verifiable-presentation'
import {
	EbsiEnvConfiguration,
	EbsiVerifiableAttestation,
	ValidationError,
	verifyCredentialJwt,
} from '@cef-ebsi/verifiable-credential'
import { z } from 'zod'
import { HTTPException } from 'hono/http-exception'

function first<T>(value: T | T[] | undefined | null): T | undefined {
	if (!value) return undefined
	return Array.isArray(value) ? value[0] : value
}

function ensureString(value: unknown, message: string): string {
	if (typeof value !== 'string' || value.length === 0)
		throw new ValidationError(message)
	return value
}

function extractVcJwtFromVp(verifiedVp: EbsiVerifiablePresentation): string {
	const vc = first(verifiedVp.verifiableCredential)

	if (vc && typeof vc === 'string') return vc

	if (vc && typeof vc === 'object') {
		const id = (vc as any).id
		const type = (vc as any).type

		const types: string[] = Array.isArray(type)
			? type
			: typeof type === 'string'
				? [type]
				: []
		const isEnveloped = types.includes('EnvelopedVerifiableCredential')

		if (isEnveloped && typeof id === 'string' && id.startsWith('data:')) {
			const commaIdx = id.indexOf(',')
			if (commaIdx === -1)
				throw new ValidationError(
					'Enveloped VC data: URL is missing a comma separator',
				)
			return id.slice(commaIdx + 1)
		}
	}

	throw new ValidationError('VP has no verifiableCredential')
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
	if (!schemaId)
		throw new ValidationError(`Invalid credentialSchema.id: ${schemaUrl}`)

	return schemaId
}

function getIssuerDid(verifiedVc: EbsiVerifiableAttestation): string {
	const issuer = verifiedVc.issuer
	if (typeof issuer === 'string') return issuer
	if (issuer && typeof issuer === 'object') {
		const id = issuer.id
		return ensureString(id, 'VC issuer is missing or not a string')
	}
	throw new ValidationError('VC issuer is missing or not a string')
}

function getRegistryEndpointFromDidDocument(
	didDocument: DIDDocument,
	issuer: string,
): string {
	const services = didDocument.service
	if (!Array.isArray(services)) {
		throw new ValidationError(
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

	throw new ValidationError(
		"Issuer's DID document does not contain an InterledgerIdentityProviderV1 service",
	)
}

async function resolveILPIdentity(
	registryEndpoint: string,
	subjectDid: string,
): Promise<Identity> {
	const url = `${registryEndpoint}/identity/${encodeURIComponent(subjectDid)}`
	const response = await fetch(url)

	if (!response.ok) {
		throw new ValidationError(
			`Failed to fetch subject's identity from registry: ${response.status} ${response.statusText}`,
		)
	}

	const data = await response.json()
	const validated = z.custom<Identity>().safeParse(data)

	if (!validated.success) {
		throw new ValidationError(
			'Invalid response from identity registry: ' +
				JSON.stringify(validated.error),
		)
	}
	return validated.data
}

export async function initResolver(ctx: AppContext) {
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
	ctx.identity.ebsiConfig = config
}

export async function verifyVp(
	ctx: AppContext,
	vpJwt: string,
): Promise<string> {
	const config = ctx.identity.ebsiConfig
	if (!config) throw new ValidationError('Identity config is not initialised')

	let verifiedVp
	try {
		verifiedVp = await verifyPresentationJwt(
			vpJwt,
			ctx.identity.issuer!.did,
			config,
		)
	} catch (e) {
		throw new HTTPException(403, { message: `Invalid VP JWT: ${e}` })
	}

	let vcJwt: string
	try {
		vcJwt = extractVcJwtFromVp(verifiedVp)
	} catch (e) {
		throw new HTTPException(403, { message: `Invalid VC JWT in VP: ${e}` })
	}

	let subjectDid: string
	try {
		subjectDid = await verifyVc(ctx, vcJwt)
	} catch (e) {
		throw new HTTPException(403, {
			message: `Counld not verify VC JWT in VP: ${e}`,
		})
	}
	return subjectDid
}

export async function verifyVc(
	ctx: AppContext,
	vcJwt: string,
): Promise<string> {
	const config = ctx.identity.ebsiConfig
	if (!config) throw new ValidationError('Identity config is not initialised')

	const resolver = ctx.identity.resolver
	if (!resolver) throw new ValidationError('DID resolver is not initialised')

	let verifiedVc
	try {
		verifiedVc = await verifyCredentialJwt(vcJwt, config)
	} catch (e) {
		throw new ValidationError(`Invalid VC JWT: ${e}`)
	}

	const subjectDid = getCredentialSubjectDid(verifiedVc)
	const schemaId = getCredentialSchemaId(verifiedVc)
	const issuer = getIssuerDid(verifiedVc)

	if (schemaId !== ctx.config.identity.ilpSchemaId) {
		throw new ValidationError(`Not ilp schema credential schema: ${schemaId}`)
	}

	const resolution = await resolver.resolve(issuer)
	const didDocument = resolution.didDocument

	if (!didDocument) {
		throw new ValidationError(
			`Unable to resolve DID document for issuer ${issuer}`,
		)
	}

	const registryEndpoint = getRegistryEndpointFromDidDocument(
		didDocument,
		issuer,
	)

	const identity = await resolveILPIdentity(registryEndpoint, subjectDid)

	if (identity.status !== 'active') {
		throw new ValidationError(
			`Subject's ILP license is not active: ${identity.status}`,
		)
	}

	return subjectDid
}
