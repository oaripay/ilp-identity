import type { JWK } from 'jose'
import type { Wallet, WalletKeyInfo, EthereumAddress } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message)
}

export function isEthereumAddress(value: string): value is EthereumAddress {
	return /^0x[0-9a-fA-F]{40}$/.test(value)
}

export function base64urlToBytes(input: string): Uint8Array {
	const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
	const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
	return Uint8Array.from(Buffer.from(b64 + pad, 'base64'))
}

export function assertHexString(
	value: unknown,
	{
		bytes,
		startsWith,
		path,
	}: { bytes?: number; startsWith?: string; path: string },
): asserts value is `0x${string}` {
	assert(typeof value === 'string', `${path} must be a string`)
	assert(
		/^0x[0-9a-fA-F]+$/.test(value),
		`${path} must be a 0x-prefixed hex string`,
	)
	if (typeof bytes === 'number') {
		assert(
			value.length === 2 + bytes * 2,
			`${path} must be ${bytes} bytes (expected length ${2 + bytes * 2})`,
		)
	}
	if (startsWith) {
		assert(
			value.startsWith(startsWith),
			`${path} must start with ${startsWith}`,
		)
	}
}

export function assertEcPublicJwk(
	value: unknown,
	{ crv, path }: { crv: 'P-256' | 'secp256k1'; path: string },
): asserts value is JWK {
	assert(isRecord(value), `${path} must be an object`)
	assert(value.kty === 'EC', `${path}.kty must be "EC"`)
	assert(value.crv === crv, `${path}.crv must be "${crv}"`)
	assert(typeof value.x === 'string', `${path}.x must be a string`)
	assert(typeof value.y === 'string', `${path}.y must be a string`)

	// Validate coordinate sizes (32 bytes for P-256 and secp256k1)
	assert(
		base64urlToBytes(value.x).length === 32,
		`${path}.x must decode to 32 bytes`,
	)
	assert(
		base64urlToBytes(value.y).length === 32,
		`${path}.y must decode to 32 bytes`,
	)
}

function assertEcPrivateJwk(
	value: unknown,
	{ crv, path }: { crv: 'P-256' | 'secp256k1'; path: string },
): asserts value is JWK {
	assertEcPublicJwk(value, { crv, path })
	assert(typeof (value as any).d === 'string', `${path}.d must be a string`)
	assert(
		base64urlToBytes((value as any).d).length === 32,
		`${path}.d must decode to 32 bytes`,
	)
}

function assertWalletKeyInfo(
	value: unknown,
	{ did, alg, path }: { did: string; alg: 'ES256' | 'ES256K'; path: string },
): asserts value is WalletKeyInfo {
	assert(isRecord(value), `${path} must be an object`)

	assert(
		typeof value.id === 'string' && value.id.length > 0,
		`${path}.id must be a non-empty string`,
	)
	assert(
		typeof value.kid === 'string' && value.kid.length > 0,
		`${path}.kid must be a non-empty string`,
	)
	assert(
		value.kid.startsWith(`${did}#`),
		`${path}.kid must start with "${did}#"`,
	)

	assert(
		typeof value.isHardwareWallet === 'boolean',
		`${path}.isHardwareWallet must be a boolean`,
	)

	// Both ES256 and ES256K private keys are 32 bytes.
	assertHexString(value.privateKeyHex, {
		bytes: 32,
		path: `${path}.privateKeyHex`,
	})

	// Uncompressed EC public key: 0x04 + 32-byte X + 32-byte Y = 65 bytes.
	assertHexString(value.publicKeyHex, {
		bytes: 65,
		startsWith: '0x04',
		path: `${path}.publicKeyHex`,
	})

	assert(
		typeof value.publicKeyPem === 'string',
		`${path}.publicKeyPem must be a string`,
	)
	assert(
		/-----BEGIN PUBLIC KEY-----/.test(value.publicKeyPem) &&
			/-----END PUBLIC KEY-----/.test(value.publicKeyPem),
		`${path}.publicKeyPem must look like a PEM public key`,
	)

	const crv = alg === 'ES256' ? 'P-256' : 'secp256k1'
	assertEcPublicJwk(value.publicKeyJwk, { crv, path: `${path}.publicKeyJwk` })
	assertEcPrivateJwk(value.privateKeyJwk, {
		crv,
		path: `${path}.privateKeyJwk`,
	})
}

export function assertWallet(value: unknown): asserts value is Wallet {
	assert(isRecord(value), `wallet must be an object`)
	assert(
		typeof value.did === 'string' && value.did.length > 0,
		`wallet.did must be a non-empty string`,
	)
	assert(value.didVersion === 1, `wallet.didVersion must be 1`)
	assert(isRecord(value.keys), `wallet.keys must be an object`)

	if (value.address !== undefined) {
		assert(typeof value.address === 'string', `wallet.address must be a string`)
		assert(
			isEthereumAddress(value.address),
			`wallet.address must be a valid Ethereum address`,
		)
	}
	if (value.accreditationId !== undefined) {
		assert(
			typeof value.accreditationId === 'string',
			`wallet.accreditationId must be a string`,
		)
	}

	assertWalletKeyInfo((value.keys as any).ES256, {
		did: value.did,
		alg: 'ES256',
		path: 'wallet.keys.ES256',
	})
	assertWalletKeyInfo((value.keys as any).ES256K, {
		did: value.did,
		alg: 'ES256K',
		path: 'wallet.keys.ES256K',
	})
}

export function parseAndValidateWalletJson(json: string): Wallet {
	const value = JSON.parse(json) as unknown
	assertWallet(value)
	return value
}
