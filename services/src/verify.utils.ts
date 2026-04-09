import { EbsiVerifiablePresentation } from '@cef-ebsi/verifiable-presentation'
import {
	EbsiVerifiableAttestation,
	ValidationError,
} from '@cef-ebsi/verifiable-credential'

function first<T>(value: T | T[] | undefined | null): T | undefined {
	if (!value) return undefined
	return Array.isArray(value) ? value[0] : value
}

function ensureString(value: unknown, message: string): string {
	if (typeof value !== 'string' || value.length === 0)
		throw new ValidationError(message)
	return value
}

export function extractVcJwtFromVp(
	verifiedVp: EbsiVerifiablePresentation,
): string {
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

export function getCredentialSubjectDid(
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

export function getCredentialSchemaId(
	verifiedVc: EbsiVerifiableAttestation,
): string {
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

export function getIssuerDid(verifiedVc: EbsiVerifiableAttestation): string {
	const issuer = verifiedVc.issuer
	if (typeof issuer === 'string') return issuer
	if (issuer && typeof issuer === 'object') {
		const id = issuer.id
		return ensureString(id, 'VC issuer is missing or not a string')
	}
	throw new ValidationError('VC issuer is missing or not a string')
}
