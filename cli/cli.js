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

			fs.writeFileSync(
				args.outfile,
				JSON.stringify(wallet, null, 4)
			)

			console.log(`newly generated wallet written to ${args.outfile}`)
		}
	},
	issue: {
		async accred(){

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