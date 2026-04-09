import { AppContext } from './types.js'
import { verifyPresentationJwt } from '@cef-ebsi/verifiable-presentation'
import {
	ValidationError,
	verifyCredentialJwt,
} from '@cef-ebsi/verifiable-credential'
import { HTTPException } from 'hono/http-exception'
import {
	resolveILPIdentity,
	resolveRegistryEndpointFromDidDocument,
} from '@oari/ilp-identity'
import {
	extractVcJwtFromVp,
	getCredentialSubjectDid,
	getCredentialSchemaId,
	getIssuerDid,
} from './verify.utils.js'

export async function verifyVpIlp(
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
		subjectDid = await verifyVcIlp(ctx, vcJwt)
	} catch (e) {
		throw new HTTPException(403, {
			message: `Counld not verify VC JWT in VP: ${e}`,
		})
	}
	return subjectDid
}

export async function verifyVcIlp(
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

	const registryEndpoint = resolveRegistryEndpointFromDidDocument(
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
