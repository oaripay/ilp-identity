import { EbsiWallet } from '@cef-ebsi/wallet-lib'
import { calculateJwkThumbprint, exportJWK, exportSPKI } from 'jose'
import type { JWK } from 'jose'
import { WalletKeyInfo, Wallet, EthereumAddress } from './types'
import { Buffer } from 'node:buffer'
import {
	generateKeyPair as nodeGenerateKeyPair,
	type KeyObject,
} from 'node:crypto'
import { promisify } from 'node:util'
import { keccak_256 } from '@noble/hashes/sha3'
import { base64urlToBytes } from './wallet.validate.js'

const generateKeyPairAsync = promisify(nodeGenerateKeyPair)

async function generateEcKeyPair(
	namedCurve: 'secp256k1' | 'prime256v1',
): Promise<{ publicKey: KeyObject; privateKey: KeyObject }> {
	const { publicKey, privateKey } = await generateKeyPairAsync('ec', {
		namedCurve,
	})
	return { publicKey, privateKey }
}

function hexToBytes(hex: string): Uint8Array {
	const h = hex.startsWith('0x') ? hex.slice(2) : hex
	return Uint8Array.from(Buffer.from(h, 'hex'))
}

export function ethAddressFromUncompressedPublicKeyHex(
	uncompressed: `0x${string}`,
): EthereumAddress {
	const pub = hexToBytes(uncompressed)
	if (pub.length !== 65 || pub[0] !== 0x04) {
		throw new Error('Expected 65-byte uncompressed public key (0x04 + x + y)')
	}

	const hash = keccak_256(pub.slice(1)) // 64 bytes (x||y)
	const addrBytes = hash.slice(-20)
	return `0x${Buffer.from(addrBytes).toString('hex')}` as EthereumAddress
}

function bytesToHex(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('hex')
}

function jwkEcPublicKeyToUncompressedHex(jwk: JWK): `0x${string}` {
	if (
		jwk.kty !== 'EC' ||
		typeof jwk.x !== 'string' ||
		typeof jwk.y !== 'string'
	) {
		throw new Error('Expected an EC public JWK with x/y')
	}
	const x = base64urlToBytes(jwk.x)
	const y = base64urlToBytes(jwk.y)
	const uncompressed = new Uint8Array(1 + x.length + y.length)
	uncompressed[0] = 0x04
	uncompressed.set(x, 1)
	uncompressed.set(y, 1 + x.length)
	return `0x${bytesToHex(uncompressed)}`
}

function jwkEcPrivateKeyToHex(jwk: JWK): `0x${string}` {
	if (jwk.kty !== 'EC' || typeof jwk.d !== 'string') {
		throw new Error('Expected an EC private JWK with d')
	}
	return `0x${bytesToHex(base64urlToBytes(jwk.d))}`
}

async function buildKeyInfo(
	did: string,
	keyPair: { publicKey: KeyObject; privateKey: KeyObject },
): Promise<WalletKeyInfo> {
	const publicKeyJwk = (await exportJWK(keyPair.publicKey as any)) as JWK
	const privateKeyJwk = (await exportJWK(keyPair.privateKey as any)) as JWK

	const id = await calculateJwkThumbprint(publicKeyJwk)
	const kid = `${did}#${id}`

	return {
		id,
		kid,
		isHardwareWallet: false,
		privateKeyHex: jwkEcPrivateKeyToHex(privateKeyJwk),
		privateKeyJwk,
		publicKeyHex: jwkEcPublicKeyToUncompressedHex(publicKeyJwk),
		publicKeyJwk,
		publicKeyPem: await exportSPKI(keyPair.publicKey as any),
	}
}

export async function createWallet(): Promise<Wallet> {
	const did = EbsiWallet.createDid()

	const pairES256K = await generateEcKeyPair('secp256k1')
	const pairES256 = await generateEcKeyPair('prime256v1')

	const es256kInfo = await buildKeyInfo(did, pairES256K)
	const es256Info = await buildKeyInfo(did, pairES256)

	const address = ethAddressFromUncompressedPublicKeyHex(
		es256kInfo.publicKeyHex,
	)

	return {
		did,
		address,
		didVersion: 1,
		keys: {
			ES256: es256Info,
			ES256K: es256kInfo,
		},
	}
}
