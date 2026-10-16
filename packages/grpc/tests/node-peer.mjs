import { constants, createServer } from 'node:http2'
import { createInterface } from 'node:readline'

if (process.versions.bun) {
	throw new Error('The HTTP/2 fault peer must run on Node, not Bun')
}

let scenario = JSON.parse(process.argv[2])
let sessions = []
let streams = []
let attemptedResets = []
let errors = []
let observations = []
let pings = 0
let pingDelays = []
let small
let stopping = false
let input = createInterface({ input: process.stdin })
let server = createServer(
	scenario.type === 'flow-control' ? { settings: { initialWindowSize: 0 } } : {}
)

function send(record) {
	process.stdout.write(JSON.stringify(record) + '\n')
}

function event(name, value = null) {
	if (!stopping) {
		observations.push({ name, value, at: performance.now() })
		send({ type: 'event', name, value })
	}
}

function frame(value, compressed = false) {
	let body = Buffer.from(value)
	let header = Buffer.alloc(5)
	header[0] = Number(compressed)
	header.writeUInt32BE(body.length, 1)
	return Buffer.concat([header, body])
}

function reply(stream, values, status = 0) {
	stream.respond(
		{ ':status': 200, 'content-type': 'application/grpc' },
		{ waitForTrailers: true }
	)
	stream.once('wantTrailers', () => stream.sendTrailers({ 'grpc-status': String(status) }))
	for (let value of values) {
		stream.write(frame(value))
	}
	stream.end()
}

function sendGoaway(session) {
	session.goaway(constants.NGHTTP2_ENHANCE_YOUR_CALM, 0, Buffer.from('too_many_pings'))
	event('goaway-sent')
	session.close()
}

server.on('session', (session) => {
	let number = sessions.push(session)
	let started = performance.now()
	session.on('error', () => {})
	session.once('goaway', (code) => event(`client-goaway-${number}`, code))
	session.once('close', () => event(`session-closed-${number}`))
	session.on('ping', () => {
		pings += 1
		pingDelays.push(performance.now() - started)
		event(`ping-${number}`, performance.now() - started)
		if (scenario.type === 'keepalive' && number === 1) {
			sendGoaway(session)
		}
	})
	event(`session-${number}`)
})

server.on('stream', (stream, headers) => {
	streams.push(stream)
	stream.on('error', () => {})
	stream.once('close', () => event('stream-closed'))
	try {
		switch (scenario.type) {
			case 'reset': {
				let reset = () => {
					attemptedResets.push(scenario.code)
					stream.close(scenario.code)
					event('reset-sent', scenario.code)
				}
				if (scenario.streaming) {
					stream.once('data', reset)
				} else {
					stream.resume()
					stream.once('end', reset)
				}
				break
			}
			case 'terminal-reset':
				reply(stream, ['value'], scenario.status)
				break
			case 'missing-status':
				stream.resume()
				stream.once('end', () => {
					stream.respond({ ':status': 200, 'content-type': 'application/grpc' })
					stream.end(Buffer.concat([frame('first'), frame('second')]))
				})
				break
			case 'premature-close':
				stream.respond({ ':status': 200, 'content-type': 'application/grpc' })
				stream.write(frame('first'))
				event('first-sent')
				break
			case 'receive-tail':
				stream.respond(
					{
						':status': 200,
						'content-type': 'application/grpc',
						...(scenario.fault === 'gzip' ? { 'grpc-encoding': 'gzip' } : {}),
					},
					{ waitForTrailers: true }
				)
				stream.once('wantTrailers', () => stream.sendTrailers({ 'grpc-status': '0' }))
				stream.write(Buffer.concat([frame('first'), frame('second')]))
				break
			case 'partial-body':
				stream.respond({ ':status': 200, 'content-type': 'application/grpc' })
				stream.write(frame('incomplete body').subarray(0, 6))
				event('first-sent')
				break
			case 'flow-control':
				if (headers[':path'] === '/test.Transport/Large') {
					event('large-started')
				} else {
					small = stream
					event('small-started')
				}
				break
			default:
				throw new Error(`Unexpected RPC for scenario ${scenario.type}`)
		}
	} catch (error) {
		errors.push(error.message)
		stream.destroy()
		throw error
	}
})

function ping() {
	return new Promise((resolve, reject) => {
		sessions[0].ping((error) => {
			if (error) {
				reject(error)
			} else {
				resolve()
			}
		})
	})
}

async function command(name) {
	switch (name) {
		case 'snapshot':
			return {
				sessions: sessions.length,
				streams: streams.length,
				attemptedResets,
				observations,
				pings,
				pingDelays,
				errors,
			}
		case 'reply-small':
			reply(small, ['concurrent response'])
			return null
		case 'reset-terminal':
			attemptedResets.push(constants.NGHTTP2_INTERNAL_ERROR)
			streams[0].close(constants.NGHTTP2_INTERNAL_ERROR)
			await ping()
			return null
		case 'send-tail': {
			let tail =
				scenario.fault === 'malformed'
					? Buffer.from([2, 0, 0, 0, 0])
					: scenario.fault === 'truncated'
						? frame('truncated').subarray(0, 7)
						: frame('invalid gzip', true)
			streams[0].end(tail)
			await ping()
			return null
		}
		case 'ping':
			await ping()
			return null
		case 'destroy-session':
			sessions[0].destroy()
			return null
		case 'send-goaway':
			sendGoaway(sessions[0])
			return null
		case 'stop':
			stopping = true
			for (let session of sessions) {
				session.destroy()
			}
			await new Promise((resolve, reject) =>
				server.close((error) => {
					if (error) {
						reject(error)
					} else {
						resolve()
					}
				})
			)
			return null
		default:
			throw new Error(`Unknown fault-peer command: ${name}`)
	}
}

input.on('line', (line) => {
	let request = JSON.parse(line)
	void command(request.command).then(
		(value) => {
			send({ type: 'response', id: request.id, value })
			if (stopping) {
				input.close()
				process.stdin.destroy()
				process.stdout.end()
			}
			return undefined
		},
		(error) => {
			console.error(error)
			process.exitCode = 1
			for (let session of sessions) {
				session.destroy()
			}
			server.close()
			input.close()
			process.stdin.destroy()
		}
	)
})

await new Promise((resolve, reject) => {
	server.once('error', reject)
	server.listen(0, '127.0.0.1', resolve)
})
send({
	type: 'ready',
	authority: `http://127.0.0.1:${server.address().port}`,
	node: process.versions.node,
	executable: process.execPath,
})
