import { signOpenId4Vci } from './openid4vci.ilp'
import { Wallet, OpenID4VCIChallengePayload } from './types'
import { ES256KSigner } from 'did-jwt'
import { z } from 'zod'

export async function resolveILPVC(issuerEndpoint: string, wallet: Wallet) {
	const responsePayload = await fetch(`${issuerEndpoint}/challenge`, {
		method: 'GET',
	})

	if (!responsePayload.ok) {
		throw new Error(
			`Failed to fetch ILPVC challenge: ${responsePayload.statusText}`,
		)
	}

	const dataPayload = await responsePayload.json()
	// TODO: if challange sign check signature
	const challengePayload = z
		.custom<OpenID4VCIChallengePayload>()
		.parse(dataPayload)

	const hex = wallet.keys.ES256K.privateKeyHex.startsWith('0x')
		? wallet.keys.ES256K.privateKeyHex.slice(2)
		: wallet.keys.ES256K.privateKeyHex
	const privateKeyBytes = Uint8Array.from(Buffer.from(hex, 'hex'))
	const signer = ES256KSigner(privateKeyBytes)

	const jwt = await signOpenId4Vci(
		challengePayload,
		wallet.did,
		challengePayload.credential_issuer,
		signer,
		'ES256K',
		wallet.keys.ES256K.kid,
	)

	const responseVc = await fetch(challengePayload.credential_endpoint, {
		method: 'POST',
		body: JSON.stringify({
			proof: {
				proof_type: 'jwt',
				jwt: jwt,
			},
		}),
	})

	if (!responseVc.ok) {
		throw new Error(
			`Failed to fetch ILPVC credential: ${responseVc.statusText}`,
		)
	}

	const dataVc = await responseVc.json()

	// TODO: maybe decode into EbsiVerifiableCredential -> router needs to have
	// the appropriate type
	return dataVc.vc
}
