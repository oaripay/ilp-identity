import { Resolver } from 'did-resolver'
import { getResolver } from '@cef-ebsi/ebsi-did-resolver'
import { createEbsiDID } from './did.ebsi.js'
import { DidError } from './error.js'


async function createDID(options = {}){
	const method = options.method ?? 'ebsi'

	switch (method){
		case 'ebsi':
			return await createEbsiDID()
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

export {
	createDID,
	createIdentityResolver,
	DidError
}
