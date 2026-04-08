import { AppContext } from './types.js'
import { Resolver } from 'did-resolver'
import { getResolver } from '@cef-ebsi/ebsi-did-resolver'
import { verifyPresentationJwt } from '@cef-ebsi/verifiable-presentation'
import {
	EbsiEnvConfiguration,
	verifyCredentialJwt,
} from '@cef-ebsi/verifiable-credential'

export async function initResolver(ctx: AppContext) {
	const resolverConfig = {
		registry: `${ctx.config.ebsi.endpoint}/did-registry-v5/identifiers`,
	}

	const ebsiResolver = getResolver(resolverConfig)
	const didResolver = new Resolver(ebsiResolver)

	const config = {
		hosts: [ctx.config.ebsi.endpoint],
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
	audience: string,
	vpJwt: string,
): Promise<string> {
	const config = ctx.identity.config!

	const verifiedVp = await verifyPresentationJwt(vpJwt, audience, config)
	const vc = verifiedVp.verifiableCredential?.[0]

	if (typeof vc === 'string') return vc

	if (vc && typeof vc === 'object') {
		const maybeJwt = (vc as { jwt?: unknown }).jwt
		if (typeof maybeJwt === 'string') return maybeJwt
		throw new Error('VP contains a VC object; expected VC JWT string')
	}

	throw new Error('VP has no verifiableCredential')
}

export async function verifyVc(ctx: AppContext, vcJwt: string) {
	const config = ctx.identity.config
	if (!config) throw new Error('Identity config is not initialised')

	const resolver = ctx.identity.resolver
	if (!resolver) throw new Error('DID resolver is not initialised')

	const verifiedVc = await verifyCredentialJwt(vcJwt, config)

	const credentialSchema = (verifiedVc as { credentialSchema?: unknown })
		.credentialSchema
	const schema = Array.isArray(credentialSchema)
		? (credentialSchema[0] as { id?: unknown } | undefined)?.id
		: (credentialSchema as { id?: unknown } | undefined)?.id

	if (typeof schema !== 'string') {
		throw new Error('VC has no credentialSchema.id')
	}

	const schemaId = schema.split('/').at(-1)
	if (!schemaId) {
		throw new Error(`Invalid credentialSchema.id: ${schema}`)
	}

	if (schemaId !== ctx.config.ebsi.ilpSchemaId) {
		throw new Error(`Not ilp schema credential schema: ${schema}`)
	}

	const issuer = verifiedVc.issuer
	if (!issuer || typeof issuer !== 'string') {
		throw new Error('VC issuer is missing or not a string')
	}

	const resolution = await resolver.resolve(issuer)
	const didDocument = resolution.didDocument

	if (!didDocument) {
		throw new Error(`Unable to resolve DID document for issuer ${issuer}`)
	}

	const services = didDocument.service
	if (!services) {
		throw new Error(
			`Unable to find services in DID document for issuer ${issuer}`,
		)
	}

	let registryEndpoint: string | undefined
	for (const service of services) {
		if (service.type === 'InterledgerIdentityProviderV1') {
		}
	}
}
