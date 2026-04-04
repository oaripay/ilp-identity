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
				`issuerWallet: load ${args.issuer.wallet}`,
				`using user issuerWallet`,
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
				`issuerWallet: load ${args.issuer.wallet}`,
				`using user issuerWallet`,
				`run issueVcTAO ${args.subject.did}`,
				`run preregisterIssuer ${args.subject.did} ${type} vcJwt`,
			)

			const vcJwt = issueOutputs.at(-1)
			const [ vc ] = await ebsiCli(
				`compute decodeJWT ${vcJwt}`
			)
			const resultJson = JSON.stringify(vc, null, 4)

			console.log(`preregistering as ${type}`)

			const preregisterOutputs = await ebsiCli(
				`issuerWallet: load ${args.issuer.wallet}`,
				`using user issuerWallet`,
				`run preregisterIssuer ${args.subject.did} ${type} ${vcJwt}`,
			)

			console.log(preregisterOutputs.at(-1))

			if(args.outfile){
				fs.writeFileSync(args.outfile, resultJson)
				console.log(`accreditation written to ${args.outfile}`)
			}else{
				console.log(resultJson)
			}
		}
	},
	register: {
		async did(){
			const extraCommands = []
			
			console.log(`registering did on chain ...`)

			if(args.lecr){
				const tempFile = path.join(os.tmpdir(), 'ebsi.tmp.txt')
				const serviceJson = JSON.stringify({
					id: args.lecr.split('://')[1],
					type: 'LegalEntityCredentialRegistry2024',
					serviceEndpoint: args.lecr
				})

				fs.writeFileSync(tempFile, serviceJson.replaceAll('"', '\\"'))

				extraCommands.push(
					`data: load ${tempFile}`,
					`did addService user.did data`
				)
			}

			const vc = JSON.parse(fs.readFileSync(args.vc, 'utf-8'))
			const outputs = await ebsiCli(
				`userWallet: load ${args.wallet}`,
				`using user userWallet`,
				`run registerDidDocument ${vc.data}.${vc.signature}`,
				...extraCommands
			)

			for(let output of outputs){
				console.log(output)
			}

			console.log('all done')
		},
		async issuer(){
			console.log(`registering trusted issuer on chain ...`)

			const vc = JSON.parse(fs.readFileSync(args.vc, 'utf-8'))
			const outputs = await ebsiCli(
				`userWallet: load ${args.wallet}`,
				`using user userWallet`,
				`run registerIssuer ${vc.data}.${vc.signature}`
			)

			for(let output of outputs){
				console.log(output)
			}

			console.log('all done')
		}
	},
	registry: {
		async serve(){
			console.log('starting registry')
			startRegistry(args)
		}
	}
}

const component = args._[0]
const action = args._[1]

await actions[component][action]()