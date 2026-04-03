import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import chokidar from 'chokidar'
import canonicalize from 'canonicalize'
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { prettyJSON } from 'hono/pretty-json'


export function startRegistry({ dir, hostname = '127.0.0.1', port = 80 }){
	if(!dir)
		throw new Error(`registry file directory not set`)

	if(!fs.existsSync(dir) || !fs.statSync(dir).isDirectory())
		throw new Error(`registry directory is not a directory`)

	const ctx = {
		dir,
		hostname,
		port,
		credentials: new Map(),
		watcher: null
	}

	startSync(ctx)
	startServer(ctx)
}


function startSync(ctx){
	const ingestFromFile = (filePath, action = 'ingested') => {
		if(path.extname(filePath).toLowerCase() !== '.json')
			return

		try {
			const raw = fs.readFileSync(filePath, 'utf8')
			const entry = JSON.parse(raw)

			if(!entry || typeof entry !== 'object' || !entry.id)
				return

			const existed = ctx.credentials.has(entry.id)
			ctx.credentials.set(entry.id, entry)

		if(action === 'changed' || existed)
			console.log(`credential ${entry.id} changed (${filePath})`)
		else
			console.log(`new credential ${entry.id} (${filePath})`)
		}
		catch (error) {
			console.warn(`invalid registry file ${filePath}:`, error.message)
		}
	}

	const removeByFile = (filePath) => {
		const fileName = path.basename(filePath)
		const hash = fileName.endsWith('.json') ? fileName.slice(0, -5) : null

		if(hash){
			ctx.credentials.delete(hash)
			console.log(`[registry] removed credential ${hash} (${filePath})`)
		}
	}

	for(const fileName of fs.readdirSync(ctx.dir))
		ingestFromFile(path.join(ctx.dir, fileName), 'ingested')

	ctx.watcher = chokidar.watch(path.join(ctx.dir, '*.json'), {
		ignoreInitial: true
	})

	ctx.watcher.on('add', (filePath) => ingestFromFile(filePath, 'ingested'))
	ctx.watcher.on('change', (filePath) => ingestFromFile(filePath, 'changed'))
	ctx.watcher.on('unlink', removeByFile)
}

function startServer(ctx){
	const app = new Hono()

	app.use(prettyJSON({
		space: 4,
		force: true
	}))

	app.post('/credentials', async (c) => {
		let body
		try {
			body = await c.req.json()
		}
		catch {
			return c.json({ error: 'request body must be valid JSON' }, 400)
		}

		if(!Array.isArray(body))
			return c.json({ error: 'request body must be an array' }, 400)

		const baseContentType = c.req.header('content-type') || 'application/json'
		const created = []

		for(const item of body){
			const payload = item?.payload ?? item
			const contentType = item?.contentType ?? item?.meta?.contentType ?? baseContentType
			const hash = computeCredentialHash(payload)

			const record = {
				id: hash,
				contentType,
				payload
			}

			const outFile = path.join(ctx.dir, `${hash}.json`)
			await fs.promises.writeFile(outFile, JSON.stringify(record, null, 2), 'utf8')
			ctx.credentials.set(hash, record)

			created.push({
				id: hash,
				href: `${new URL(c.req.url).origin}/credentials/${hash}`,
				contentType
			})
		}

		return c.json({ items: created }, 200)
	})

	app.get('/credentials/:credentialHash', (c) => {
		const credentialHash = c.req.param('credentialHash')
		const record = ctx.credentials.get(credentialHash)

		if(!record)
			return c.json({ error: 'credential not found' }, 404)

		c.header('content-type', record.contentType || 'application/json')
		return c.body(typeof record.payload === 'string' ? record.payload : JSON.stringify(record.payload))
	})

	app.delete('/credentials/:credentialHash', async (c) => {
		const credentialHash = c.req.param('credentialHash')
		const record = ctx.credentials.get(credentialHash)

		if(!record)
			return c.json({ error: 'credential not found' }, 404)

		await fs.promises.unlink(path.join(ctx.dir, `${credentialHash}.json`)).catch(() => {})
		ctx.credentials.delete(credentialHash)
		return c.body(null, 204)
	})
	
	serve({ 
		fetch: app.fetch,
		port: ctx.port,
		hostname: ctx.hostname
	})
	
	console.log(`listening on port ${ctx.port}`)
}


function computeCredentialHash(payload){
	const canonical = canonicalize(payload)

	if(typeof canonical !== 'string')
		throw new Error('payload is not JCS-canonicalizable')

	return crypto.createHash('sha256').update(canonical).digest('hex')
}