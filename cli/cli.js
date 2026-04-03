#!/usr/bin/env node

import fs from 'fs'
import minimist from 'minimist'
import pkg from './package.json' with { type: 'json' }
import { ebsiCli } from './ebsi.js'
import { startRegistry } from '../registry/registry.js'

const args = minimist(process.argv.slice(2))

console.log(`*** ILP Trust CLI ${pkg.version} ***`)

const actions = {
	wallet: {
		async create(){
			if (fs.existsSync(args.outfile) && !args.force) {
				console.warn(`warning: ${args.outfile} already exists. Use --force to overwrite.`)
				return
			}

			const [ wallet ] = await ebsiCli(
				'using user ES256 did1'
			)

			const resultJson = JSON.stringify(wallet, null, 4)

			if(args.outfile){
				fs.writeFileSync(args.outfile, resultJson)
				console.log(`newly generated wallet written to ${args.outfile}`)
			}else{
				console.log(resultJson)
			}
		}
	},
	issue: {
		async accred(){
			const issuerWallet = JSON.parse(fs.readFileSync(args.issuer.wallet, 'utf-8'))

			console.log(`accrediting ${args.subject.did} as ${issuerWallet.did} ...`)

			const outputs = await ebsiCli(
				`using user ES256 did1 ${issuerWallet.keys.ES256.privateKeyHex} ${issuerWallet.did}`,
				`run issueVcTAO ${args.subject.did}`
			)

			const vcJwt = outputs.at(-1)
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
	chain: {
		async put(){
			
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