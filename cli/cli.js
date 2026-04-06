#!/usr/bin/env node

import os from 'os'
import fs from 'fs'
import path from 'path'
import minimist from 'minimist'
import { ebsiCli } from './ebsi.js'
import { startRegistry } from '../registry/registry.js'

const args = minimist(process.argv.slice(2))

const actions = {
	wallet: {
		async create(){
			if (fs.existsSync(args.outfile) && !args.force) {
				console.warn(`warning: ${args.outfile} already exists. Use --force to overwrite.`)
				return
			}

			const outputs = await ebsiCli(
				'using user ES256K did1',
				'using user ES256 did1',
				'view user',
			)

			const resultJson = JSON.stringify(outputs.at(-1), null, 4)

			if(args.outfile){
				fs.writeFileSync(args.outfile, resultJson)
				console.log(`newly generated wallet written to ${args.outfile}`)
			}else{
				console.log(resultJson)
			}
		}
	},
	issue: {
		async onboard(){
			console.log(`creating onboarding for ${args.subject.did} ...`)

			const outputs = await ebsiCli(
				...useIssuerWallet(),
				`run issueVcOnboard ${args.subject.did}`
			)

			const vcJwt = outputs.at(-1)
			const [ vc ] = await ebsiCli(
				`compute decodeJWT ${vcJwt}`
			)
			
			const resultJson = JSON.stringify(vc, null, 4)

			if(args.outfile){
				fs.writeFileSync(args.outfile, resultJson)
				console.log(`onboarding credential written to ${args.outfile}`)
			}else{
				console.log(resultJson)
			}
		},
		async accred(){
			const type = args.type ?? 'TI'

			console.log(`accrediting ${args.subject.did} ...`)

			const issueOutputs = await ebsiCli(
				...useIssuerWallet(),
				`run issueVc${type} ${args.subject.did}`
			)

			const vcJwt = issueOutputs.at(-1)
			const [ vc ] = await ebsiCli(
				`compute decodeJWT ${vcJwt}`
			)
			const resultJson = JSON.stringify(vc, null, 4)

			console.log(`preregistering ${vc.payload.vc.credentialSubject.id} as ${type}`)

			const preregisterOutputs = await ebsiCli(
				...useIssuerWallet(),
				`run preregisterIssuer ${args.subject.did} ${type.toLowerCase()} ${vcJwt}`,
			)

			if(preregisterOutputs.at(-1).includes('"revisionId"')){
				console.log(`preregistration as ${type} successful`)
			}else{
				console.log(preregisterOutputs.at(-1))
			}

			if(args.outfile){
				fs.writeFileSync(args.outfile, resultJson)
				console.log(`accreditation written to ${args.outfile}`)
			}else{
				console.log(resultJson)
			}
		},
		async license(){
			console.log(`licensing ${args.subject.did} ...`)

			const issueOutputs = await ebsiCli(
				...useIssuerWallet(),
				`licenseId: compute randomID`,
				`license: load ${path.resolve(path.join(import.meta.dirname, 'ilp-license.json'))}`,
				`set license.id licenseId`,
				`set license.issuer issuerWallet.did`,
				`set license.credentialSubject.id ${args.subject.did}`,
				args.subject.country
					? `set license.credentialSubject.country ${args.subject.country}`
					: null,
				`compute createVcJwt license {} ES256 1.1`
			)

			const vcJwt = issueOutputs.at(-1)
			const [ vc ] = await ebsiCli(
				`compute decodeJWT ${vcJwt}`
			)
			const resultJson = JSON.stringify(vc, null, 4)

			if(args.outfile){
				fs.writeFileSync(args.outfile, resultJson)
				console.log(`accreditation written to ${args.outfile}`)
			}else{
				console.log(resultJson)
			}
		}
	},
	register: {
		async onboard(){
			if(!fs.existsSync(args.wallet))
				throw new Error(`wallet file (--wallet) does not exist`)

			const extraCommands = []
			const vc = JSON.parse(fs.readFileSync(args.vc, 'utf-8'))
			const did = vc.payload.vc.credentialSubject.id

			console.log(`registering ${did} on chain ...`)

			if(args.registry){
				const registry = String(args.registry).trim().replace(/^['"]|['"]$/g, '')
				const registryUrl = new URL(registry)
				const domain = registryUrl.hostname.split('.').reverse()
				const tempFile1 = path.join(os.tmpdir(), 'ebsi.ilp1.txt')
				const tempFile2 = path.join(os.tmpdir(), 'ebsi.ilp2.txt')

				const identityJson = JSON.stringify({
					id: `${domain}.ilp.identity`,
					type: 'InterledgerIdentityProviderV1',
					serviceEndpoint: registry + '/identity'
				})

				const nodesJson = JSON.stringify({
					id: `${domain}.ilp.nodes`,
					type: 'InterledgerEntryNodeListV1',
					serviceEndpoint: registry + '/nodes'
				})

				fs.writeFileSync(tempFile1, identityJson.replaceAll('"', '\\"'))
				fs.writeFileSync(tempFile2, nodesJson.replaceAll('"', '\\"'))

				extraCommands.push(
					`nodeService: load ${tempFile2}`,
					`did addService user.did nodeService`,
					`identityService: load ${tempFile1}`,
					`did addService user.did identityService`
					
				)
			}

			const outputs = await ebsiCli(
				`userWallet: load ${args.wallet}`,
				`using user userWallet`,
				`run registerDidDocument ${vc.data}.${vc.signature}`,
				...extraCommands
			)

			const lastOutput = outputs.at(-1)
			
			if(lastOutput.includes('did:ebsi') && !lastOutput.includes('error')){
				console.log(`${did} successfully registered on chain`)
			}else{
				console.log(outputs.at(-1))
				return
			}

			if(args.registry){
				const domain = args.registry.split('://')[1].split('/')[0].split('.').reverse()
				const tempFile1 = path.join(os.tmpdir(), 'ebsi.ilp1.txt')
				const tempFile2 = path.join(os.tmpdir(), 'ebsi.ilp2.txt')

				const identityJson = JSON.stringify({
					id: `${domain}.ilp.identity`,
					type: 'InterledgerIdentityProviderV1',
					serviceEndpoint: args.registry + '/identity'
				})

				const nodesJson = JSON.stringify({
					id: `${domain}.ilp.nodes`,
					type: 'InterledgerEntryNodeListV1',
					serviceEndpoint: args.registry + '/nodes'
				})

				fs.writeFileSync(tempFile1, identityJson.replaceAll('"', '\\"'))
				fs.writeFileSync(tempFile2, nodesJson.replaceAll('"', '\\"'))

				extraCommands.push(
					`nodeService: load ${tempFile2}`,
					`did addService user.did nodeService`,
					`identityService: load ${tempFile1}`,
					`did addService user.did identityService`
					
				)
			}
		},
		async accred(){
			if(!fs.existsSync(args.wallet))
				throw new Error(`wallet file (--wallet) does not exist`)

			console.log(`registering trusted issuer on chain ...`)

			const vc = JSON.parse(fs.readFileSync(args.vc, 'utf-8'))
			const outputs = await ebsiCli(
				`userWallet: load ${args.wallet}`,
				`using user userWallet`,
				`run registerIssuer ${vc.data}.${vc.signature}`
			)

			if(outputs.at(-1).includes('attributeId')){
				console.log('successfully registered on chain')
			}else{
				console.log(outputs.at(-1))
			}
		}
	},
	registry: {
		async start(){
			console.log('starting registry')
			startRegistry(args)
		}
	}
}

function useIssuerWallet(){
	const wallet = JSON.parse(fs.readFileSync(args.issuer.wallet))

	if(wallet.accreditationUrl)
		return [
			`issuerWallet: load ${args.issuer.wallet}`,
			`using user issuerWallet`,
		]
	else return [
		`issuerWallet: load ${args.issuer.wallet}`,
		`issuerAttributes: tir get /issuers/ issuerWallet.did /attributes`,
		`set issuerWallet.accreditationUrl issuerAttributes.items.0.href`,
		`using user issuerWallet`,
	]
}

const component = args._[0]
const action = args._[1]
await actions[component][action]()