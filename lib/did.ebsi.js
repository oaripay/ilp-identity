import { createHash, createPublicKey, generateKeyPairSync, randomBytes } from 'node:crypto'
import { Wallet } from 'ethers'
import { util as ebsiDidUtil } from '@cef-ebsi/ebsi-did-resolver'


function normalizeEcPrivateJwk(privateKeyJwk){
	return {
		crv: privateKeyJwk.crv,
		d: privateKeyJwk.d,
		kty: privateKeyJwk.kty,
		x: privateKeyJwk.x,
		y: privateKeyJwk.y,
	}
}

function normalizeEcPublicJwk(publicKeyJwk){
	return {
		crv: publicKeyJwk.crv,
		kty: publicKeyJwk.kty,
		x: publicKeyJwk.x,
		y: publicKeyJwk.y,
	}
}

function toHex(base64UrlValue){
	return Buffer.from(base64UrlValue, 'base64url').toString('hex')
}

function toPrivateKeyHex(privateKeyJwk){
	return `0x${toHex(privateKeyJwk.d)}`
}

function toPublicKeyHex(publicKeyJwk){
	return `0x04${toHex(publicKeyJwk.x)}${toHex(publicKeyJwk.y)}`
}

function toPublicKeyPem(publicKeyJwk){
	return createPublicKey({
		key: publicKeyJwk,
		format: 'jwk',
	})
		.export({
			format: 'pem',
			type: 'spki',
		})
		.toString('utf-8')
}

function createJwkThumbprint(publicKeyJwk){
	const canonicalJwk = JSON.stringify({
		crv: publicKeyJwk.crv,
		kty: publicKeyJwk.kty,
		x: publicKeyJwk.x,
		y: publicKeyJwk.y,
	})

	return createHash('sha256')
		.update(canonicalJwk)
		.digest()
		.toString('base64url')
}

function createKeyMaterial(namedCurve){
	const { privateKey } = generateKeyPairSync('ec', { namedCurve })
	const privateKeyJwk = normalizeEcPrivateJwk(privateKey.export({ format: 'jwk' }))
	const publicKeyJwk = normalizeEcPublicJwk(
		createPublicKey(privateKey).export({ format: 'jwk' })
	)

	return {
		privateKeyHex: toPrivateKeyHex(privateKeyJwk),
		privateKeyJwk,
		publicKeyHex: toPublicKeyHex(publicKeyJwk),
		publicKeyJwk,
		publicKeyPem: toPublicKeyPem(publicKeyJwk),
	}
}

function createVerificationMethod({ did, keyMaterial }){
	const id = createJwkThumbprint(keyMaterial.publicKeyJwk)

	return {
		id,
		isHardwareWallet: false,
		kid: `${did}#${id}`,
		privateKeyHex: keyMaterial.privateKeyHex,
		privateKeyJwk: keyMaterial.privateKeyJwk,
		publicKeyHex: keyMaterial.publicKeyHex,
		publicKeyJwk: keyMaterial.publicKeyJwk,
		publicKeyPem: keyMaterial.publicKeyPem,
	}
}

function createDid(){
	return ebsiDidUtil.createDid(randomBytes(16))
}

async function createEbsiDID(){
	const did = createDid()
	const es256k = createKeyMaterial('secp256k1')
	const es256 = createKeyMaterial('prime256v1')

	return {
		accreditationId: undefined,
		accreditationUrl: undefined,
		address: new Wallet(es256k.privateKeyHex).address,
		clientId: undefined,
		did,
		didVersion: 1,
		issuerState: undefined,
		keys: {
			ES256K: createVerificationMethod({ did, keyMaterial: es256k }),
			ES256: createVerificationMethod({ did, keyMaterial: es256 }),
		},
		proxyId: undefined,
		supportOfficeAccreditationUrl: undefined,
	}
}

export {
	createEbsiDID,
}