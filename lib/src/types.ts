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
