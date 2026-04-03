import { spawn } from 'child_process'

export async function ebsiCli(...commands){
	const commandList = commands
		.flat()
		.filter((command) => typeof command === 'string' && command.trim().length > 0)

	if(commandList.length === 0){
		return []
	}

	return await new Promise((resolve, reject) => {
		const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx'
		const child = spawn(executable, ['@cef-ebsi/cli'], {
			stdio: ['pipe', 'pipe', 'pipe']
		})

		let stdoutBuffer = ''
		let stderrBuffer = ''
		const responses = []
		let settled = false
		const timeout = setTimeout(() => {
			fail(new Error('Timed out while waiting for EBSI CLI JSON responses.'))
		}, 30_000)

		const cleanup = () => {
			child.stdout.removeAllListeners()
			child.stderr.removeAllListeners()
			child.removeAllListeners()
		}

		const fail = (error) => {
			if(settled){
				return
			}

			settled = true
			clearTimeout(timeout)
			cleanup()

			error.stdout = stdoutBuffer
			error.stderr = stderrBuffer

			if(child.pid){
				child.kill('SIGTERM')
			}

			reject(error)
		}

		const succeed = () => {
			if(settled){
				return
			}

			settled = true
			clearTimeout(timeout)
			cleanup()

			if(child.pid){
				child.kill('SIGTERM')
			}

			resolve(responses)
		}

		const parseJsonObjects = (input) => {
			const objects = []
			let start = -1
			let depth = 0
			let inString = false
			let escaped = false
			let consumedUntil = 0

			for(let i = 0; i < input.length; i++){
				const char = input[i]

				if(inString){
					if(escaped){
						escaped = false
						continue
					}

					if(char === '\\'){
						escaped = true
						continue
					}

					if(char === '"'){
						inString = false
					}

					continue
				}

				if(char === '"'){
					inString = true
					continue
				}

				if(char === '{'){
					if(depth === 0){
						start = i
					}
					depth += 1
					continue
				}

				if(char === '}'){
					if(depth > 0){
						depth -= 1
					}

					if(depth === 0 && start !== -1){
						const candidate = input.slice(start, i + 1)
						try{
							objects.push(JSON.parse(candidate))
							consumedUntil = i + 1
						}catch{
							// Keep collecting data for a complete JSON block.
						}
						start = -1
					}
				}
			}

			return {
				objects,
				remainder: input.slice(consumedUntil)
			}
		}

		child.stdout.on('data', (chunk) => {
			stdoutBuffer += chunk.toString('utf8')
			const { objects, remainder } = parseJsonObjects(stdoutBuffer)
			stdoutBuffer = remainder

			for(const object of objects){
				responses.push(object)
			}

			if(responses.length >= commandList.length){
				succeed()
			}
		})

		child.stderr.on('data', (chunk) => {
			stderrBuffer += chunk.toString('utf8')
		})

		child.on('error', (error) => {
			fail(error)
		})

		child.on('close', (code) => {
			if(settled){
				return
			}

			if(responses.length >= commandList.length){
				succeed()
				return
			}

			fail(new Error(`EBSI CLI terminated before all responses were collected (code ${code ?? 'null'}).`))
		})

		for(const command of commandList){
			child.stdin.write(`${command}\n`)
		}
	})
}