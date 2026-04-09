import { AppContext } from './types.js'
import { Resolver } from 'did-resolver'
import { getResolver } from '@cef-ebsi/ebsi-did-resolver'
import { EbsiEnvConfiguration } from '@cef-ebsi/verifiable-credential'

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
