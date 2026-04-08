export function parseBind(bind: string): { hostname: string; port: number } {
	const trimmed = bind.trim()
	const idx = trimmed.lastIndexOf(':')

	if (idx <= 0 || idx === trimmed.length - 1)
		throw new Error(`invalid bind address "${bind}", expected "host:port"`)

	const hostname = trimmed.slice(0, idx)
	const portText = trimmed.slice(idx + 1)
	const port = Number(portText)

	if (!Number.isInteger(port) || port < 1 || port > 65535)
		throw new Error(`invalid port in bind address "${bind}"`)

	return { hostname, port }
}
