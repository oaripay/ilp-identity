import { Resolver } from 'did-resolver'
import { getResolver } from '@cef-ebsi/ebsi-did-resolver'
import { DidError } from './error.js'


async function createDID(options = {}){
	const method = options.method ?? 'key'

	switch (method){
		case 'key': 
			return await createKeyDID()
		default:
			throw new Error(`Unsupported DID method "${method}"`)
	}
}

function createIdentityResolver({ registry }){
	const ebsiResolver = new Resolver(
		getResolver({
			registry: `${registry}/did-registry/v5/identifiers`
		})
	)

	return async did => {
		const [scheme, method, ...path] = did.split(':')
		const id = path.join(':')

		if(scheme !== 'did' || !method || !id)
			throw new DidError('Not a valid DID')

		switch (method){
			case 'ebsi': {
				const { didDocument } = await ebsiResolver.resolve(did)
				return didDocument
				break
			}
			default:
				throw new DidError(`Unsupported DID method "${method}" for DID "${did}"`)
		}
	}
}

const resolve = createIdentityResolver({
	registry: 'https://ebsi.oari.io'
})

console.log(await resolve('did:ebsi:zr5cv92MiWFRaDXbZmYpqR7'))

/*
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
*/

export {
	createDID,
	DidError
}
