
async function resolveDID(ctx: AppContext, did: DID): Promise<any>{
	const {
		didDocument,
		didDocumentMetadata,
		didResolutionMetadata
	} = await ctx.identity.resolver?.resolve(did)

	if(!didDocument){
		if(
			['notFound', 'invalidDid']
				.includes(didResolutionMetadata.error)
		)
			throw new UserError(didResolutionMetadata.message)
		else
			throw new Error(didResolutionMetadata.message)
	}

	return didDocument
}

async function resolveVCs(ctx: AppContext, didDocument: DIDDocument): Promise<any>{
	const [_, method, __] = didDocument.did.split(':')
	let lecr

	if(method === 'ebsi'){
		lecr = await resolveEbsiLecr(didDocument)
	}else{
		throw new UserError(`unsupported did method "${method}"`)
	}


}

type LecrResolution = {
	service: any
	configuration: any
	listUrl: string
	configUrl: string
}

async function resolveEbsiLecr(didDocument: DIDDocument): Promise<LecrResolution | undefined>{
	const services = Array.isArray(didDocument?.service) ? didDocument.service : []
	const lecr = services.find((s: any) => s?.type === 'LegalEntityCredentialRegistry2024')

	if(!lecr)
		return

	const candidates = [lecr.serviceEndpoint, ...(lecr.fallbackEndpoints ?? [])]
		.filter(Boolean)
		.map((u: string) => String(u).replace(/\/$/, ''))

	for(const base of candidates){
		const confUrl = `${base}/configuration`
		const conf = await fetch(confUrl)
			.then((r) => (r.ok ? r.json() : null))
			.catch(() => null)

		if(conf?.service_endpoint_type !== 'LegalEntityCredentialRegistry2024')
			continue

		if(conf.multi_tenant){
			const tenantBase = `${base}/identifiers/${encodeURIComponent(didDocument.did)}/credentials`
			return {
				service: lecr,
				configuration: conf,
				listUrl: tenantBase,
				configUrl: `${tenantBase}/configuration`,
			}
		}

		return {
			service: lecr,
			configuration: conf,
			listUrl: base,
			configUrl: confUrl,
		}
	}
}