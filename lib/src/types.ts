import { JWK } from 'jose'

export type OpenID4VCIChallengePayload = {
	did: string
	status: string
	credential_issuer: string
	credential_endpoint: string
	c_nonce: string
	c_nonce_expires_in: number
	proof_types_supported: {
		jwt: {
			proof_signing_alg_values_supported: Array<'ES256' | 'ES256K'>
			typ: 'openid4vci-proof+jwt'
		}
	}
}

export type EthereumAddress = `0x${string}`

export interface WalletKeyInfo {
	id: string
	kid: string
	isHardwareWallet: boolean
	privateKeyHex: `0x${string}`
	privateKeyJwk: JWK
	publicKeyHex: `0x${string}`
	publicKeyJwk: JWK
	publicKeyPem: string
}

export interface Wallet {
	accreditationId?: string
	address?: EthereumAddress
	did: string
	didVersion: 1
	keys: {
		ES256: WalletKeyInfo
		ES256K: WalletKeyInfo
	}
}

export type Identity = {
	status: 'active' | 'revoked'
	did: string
	legalInformation: {
		name: string
		street: string
		city: string
		country: string
		email: string
		website: string
		commercialRegisterNumber: string
		vatId: string
	}
	vcId: string | null
	vc: string | null
}
