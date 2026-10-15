import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { type AddressInfo, createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import ts from 'typescript'
import { expect, test } from 'vitest'

import { rawServer, reply } from '../tests/fixtures.ts'

// A child process exposes socket ref/unref behavior that a running test worker would hide.
async function childRuntime() {
	let directory = await mkdtemp(join(tmpdir(), 'ydb-grpc-process-'))
	let sourceDirectory = new URL('./', import.meta.url)

	try {
		await writeFile(join(directory, 'package.json'), '{"type":"module"}')
		await Promise.all(
			['index', 'service', 'client', 'deadline', 'error', 'metadata', 'framing'].map(
				async (name) => {
					let input = await readFile(new URL(`${name}.ts`, sourceDirectory), 'utf8')
					let { outputText } = ts.transpileModule(input, {
						compilerOptions: {
							target: ts.ScriptTarget.ES2022,
							module: ts.ModuleKind.ESNext,
						},
						fileName: `${name}.ts`,
					})
					await writeFile(join(directory, `${name}.js`), outputText)
				}
			)
		)
	} catch (error) {
		await rm(directory, { recursive: true, force: true })
		throw error
	}

	return {
		async execute(authority: string, body: string, signal: AbortSignal) {
			let entry = pathToFileURL(join(directory, 'index.js')).href
			let source = `
import { Client } from ${JSON.stringify(entry)}
let authority = ${JSON.stringify(authority)}
let client = new Client(authority, { keepaliveIntervalMs: 10, keepaliveTimeoutMs: 1000 })
let method = {
	path: '/test.Transport/Unary',
	requestStream: false,
	responseStream: false,
	requestSerialize: value => Buffer.from(value),
	responseDeserialize: bytes => Buffer.from(bytes).toString(),
}
${body}
`
			return promisify(execFile)(
				process.execPath,
				['--input-type=module', '--eval', source],
				{
					signal,
					timeout: 2000,
					killSignal: 'SIGKILL',
				}
			)
		},
		[Symbol.asyncDispose]() {
			return rm(directory, { recursive: true, force: true })
		},
	}
}

test('exits naturally after connecting without calls despite idle keepalive', async (tc) => {
	await using peer = await rawServer((stream) => reply(stream, ['unexpected']))
	await using runtime = await childRuntime()

	let { stdout } = await runtime.execute(
		peer.authority,
		`
await client.connect()
console.log('connected')
`,
		tc.signal
	)

	expect(stdout.trim()).toBe('connected')
	expect(peer.streams).toHaveLength(0)
})

test('exits naturally after a successful call without explicitly closing the client', async (tc) => {
	await using peer = await rawServer((stream) => reply(stream, ['complete']))
	await using runtime = await childRuntime()

	let { stdout } = await runtime.execute(
		peer.authority,
		`
for await (let value of client.call(method, 'request')) {
	console.log(value)
}
`,
		tc.signal
	)

	expect(stdout.trim()).toBe('complete')
})

test('keeps the process alive while a call waits for its response', async (tc) => {
	await using peer = await rawServer(async (stream) => {
		await setTimeout(100, undefined, { signal: tc.signal })
		reply(stream, ['delayed response'])
	})
	await using runtime = await childRuntime()

	let { stdout } = await runtime.execute(
		peer.authority,
		`
for await (let value of client.call(method, 'request')) {
	console.log(value)
}
`,
		tc.signal
	)

	expect(stdout.trim()).toBe('delayed response')
})

test('keeps the process alive until an unanswered call reaches its deadline', async (tc) => {
	await using peer = await rawServer((stream) => {
		stream.respond({ ':status': 200, 'content-type': 'application/grpc' })
	})
	await using runtime = await childRuntime()

	let { stdout } = await runtime.execute(
		peer.authority,
		`
try {
	for await (let value of client.call(method, 'request', { deadline: Date.now() + 100 })) {
		console.log(value)
	}
} catch (error) {
	console.log(error.code)
}
`,
		tc.signal
	)

	expect(stdout.trim()).toBe('4')
})

test('exits naturally after the only call is cancelled during HTTP/2 setup', async (tc) => {
	await using peer = createServer((socket) => socket.resume())
	await new Promise<void>((resolve, reject) => {
		peer.once('error', reject)
		peer.listen(0, '127.0.0.1', resolve)
	})
	let { port } = peer.address() as AddressInfo
	await using runtime = await childRuntime()

	let { stdout } = await runtime.execute(
		`http://127.0.0.1:${port}`,
		`
let controller = new AbortController()
setTimeout(() => controller.abort(new Error('cancelled')), 50).unref()
try {
	for await (let value of client.call(method, 'request', { signal: controller.signal })) {
		console.log(value)
	}
} catch (error) {
	console.log(error.message)
}
`,
		tc.signal
	)

	expect(stdout.trim()).toBe('cancelled')
})

test('keeps another connection waiter alive when one caller cancels', async (tc) => {
	await using peer = createServer((socket) => socket.resume())
	await new Promise<void>((resolve, reject) => {
		peer.once('error', reject)
		peer.listen(0, '127.0.0.1', resolve)
	})
	let { port } = peer.address() as AddressInfo
	await using runtime = await childRuntime()

	let { stdout } = await runtime.execute(
		`http://127.0.0.1:${port}`,
		`
let shared = new Client(authority, { connectTimeoutMs: 120 })
let controller = new AbortController()
let first = shared.connect(controller.signal).catch(error => error.message)
let second = shared.connect().catch(error => error.code)
setTimeout(() => controller.abort(new Error('first cancelled')), 30).unref()
console.log(await first)
console.log(await second)
`,
		tc.signal
	)

	expect(stdout.trim()).toBe('first cancelled\n14')
})
