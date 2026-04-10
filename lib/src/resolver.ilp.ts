import { DIDDocument } from 'did-resolver'
import { type Identity } from './types.js'
import { ValidationError } from './errors.js'
import { z } from 'zod'

function first<T>(value: T | T[] | undefined | null): T | undefined {
	if (!value) return undefined
	return Array.isArray(value) ? value[0] : value
}

// TODO: challange can be signed by the issuer
// validate the signature by resolving the issuer's did document
// and verifying the signature with the appropriate public key
export async function resolveILPIdentity(
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

export function resolveILPEntryNodeEndpointFromDidDocument(
	didDocument: DIDDocument,
): string {
	const services = didDocument.service
	if (!Array.isArray(services)) {
		throw new ValidationError(
			`Unable to find services in DID document for issuer ${didDocument.id}`,
		)
	}

	for (const service of services) {
		if (
			service &&
			typeof service === 'object' &&
			service.type === 'InterledgerEntryNodeListV1'
		) {
			const endpoint = first(service.serviceEndpoint)
			if (typeof endpoint === 'string' && endpoint.length > 0) return endpoint
		}
	}

	throw new ValidationError(
		"Issuer's DID document does not contain an InterledgerEntryNodeListV1 service",
	)
}

export function resolveILPRegistryEndpointFromDidDocument(
	didDocument: DIDDocument,
): string {
	const services = didDocument.service
	if (!Array.isArray(services)) {
		throw new ValidationError(
			`Unable to find services in DID document for issuer ${didDocument.id}`,
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
