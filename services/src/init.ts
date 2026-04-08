#!/usr/bin/env node
/// <reference types="node" />

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import descriptor from '../package.json' with { type: 'json' }
import { initApi } from './api/index.ts'
import { configFromEnv } from './config.ts'
import { initDatabase } from './db/init.ts'
import { initDidResolver } from './did.ts'
import { initLogger, info } from './log.ts'
import type { AppContext } from './types.ts'

const config = configFromEnv()
const db = initDatabase({ config })

const ctx: AppContext = {
	srcDir: path.dirname(fileURLToPath(import.meta.url)),
	version: descriptor.version,
	logger: initLogger(config),
	config,
	db,
	api: {}
}

info(ctx, 'init', `*** ILP IDENTITY SERVICES v${descriptor.version} ***`)
info(ctx, 'init', `using sqlite store "${config.db.file}"`)
info(ctx, 'init', `public api bind is ${config.api.publicBind}`)
info(ctx, 'init', `private api bind is ${config.api.privateBind}`)
info(ctx, 'init', `credential issuer is ${config.identity.issuer}`)

initApi(ctx)