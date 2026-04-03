import { spawn } from 'child_process'

export async function ebsiCli(...commands){
	const commandList = commands
		.flat()
		.filter((command) => typeof command === 'string' && command.trim().length > 0)

	if(commandList.length === 0){
		return []
	}

	return await new Promise((resolve, reject) => {
		let settled = false
		let stderrBuffer = ''
		let stdoutBuffer = ''
		let stdoutTimeout

		const responses = []
		const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx'
		const child = spawn(executable, ['@cef-ebsi/cli'], {
			stdio: ['pipe', 'pipe', 'pipe']
		})

		const cleanup = () => {
			child.stdout.removeAllListeners()
			child.stderr.removeAllListeners()
			child.removeAllListeners()
		}

		const processBuffer = () => {
			if(!stdoutBuffer.endsWith('==> \x1b[5G'))
				return

			clearTimeout(stdoutTimeout)
			stdoutTimeout = setTimeout(
				() => {
					const outputs = stdoutBuffer
						.split(/\n.*==>.*(\r\n)?/g)
						.slice(2)
						.map(part => part?.trim())
						.filter(part => part && part.length > 0)

					for(let output of outputs){
						if(output.startsWith('{'))
							responses.push(JSON.parse(output))
						else
							responses.push(output)
					}

					next()
				},
				500
			)
		}

		const fail = (error) => {
			if(settled)
				return
			
			settled = true
			cleanup()

			error.stdout = stdoutBuffer
			error.stderr = stderrBuffer

			if(child.pid)
				child.kill('SIGTERM')

			reject(error)
		}

		const succeed = () => {
			if(settled)
				return
			
			settled = true
			cleanup()

			if(child.pid)
				child.kill('SIGTERM')

			resolve(responses)
		}

		const next = () => {
			if(commands.length === 0)
				succeed()
			else
				child.stdin.write(`${commands.shift()}\n`)
		}

		child.stdout.on('data', (chunk) => {
			stdoutBuffer += chunk.toString('utf8')
			processBuffer()
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

			fail(new Error(`EBSI CLI terminated before all responses were collected (code ${code ?? 'null'}).`))
		})

		next()
	})
}