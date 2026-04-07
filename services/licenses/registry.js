import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import canonicalize from 'canonicalize'
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { prettyJSON } from 'hono/pretty-json'
import { parseBind } from './utils.js'


export function startRegistry({ bind = '127.0.0.1:80', db = 'registry.db' }){
	const { port, hostname } = parseBind(bind)
	const ctx = {
		config: {
			port,
			hostname
		},
		port,
		credentials: new Map(),
		watcher: null
	}


	startSync(ctx)
	startServer(ctx)
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
		port: ctx.config.port,
		hostname: ctx.config.hostname
	})
	
	console.log(`listening on port ${port}`)
}


function computeCredentialHash(payload){
	const canonical = canonicalize(payload)

	if(typeof canonical !== 'string')
		throw new Error('payload is not JCS-canonicalizable')

	return crypto.createHash('sha256').update(canonical).digest('hex')
}