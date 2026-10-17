import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { Server } from '@ydbjs/grpc'
import { expect, test } from 'vitest'

import { runMemoryProfile } from '../tests/memory-profile.ts'

let execute = promisify(execFile)
let grpcEntry = new URL('../../grpc/dist/index.js', import.meta.url).href
let method = {
	path: '/memory.Proxy/Probe',
	requestStream: false,
	responseStream: false,
	requestSerialize: (value: string) => Buffer.from(value),
	requestDeserialize: (value: Uint8Array) => Buffer.from(value).toString(),
	responseSerialize: (value: string) => Buffer.from(value),
	responseDeserialize: (value: Uint8Array) => Buffer.from(value).toString(),
}

// Certificate failures need a local server with a deliberately invalid identity.
async function proxyFixture(signal: AbortSignal, certificateName?: string, trusted = true) {
	let directory = await mkdtemp(join(tmpdir(), 'topic-memory-proxy-'))
	let server: Server | undefined
	let environment = new Map(
		['GRPC_DEFAULT_SSL_ROOTS_FILE_PATH', 'no_grpc_proxy', 'no_proxy'].map((key) => [
			key,
			process.env[key],
		])
	)
	let dispose = async () => {
		server?.destroy()
		await server?.close()
		for (let [key, value] of environment) {
			if (value === undefined) {
				delete process.env[key]
			} else {
				process.env[key] = value
			}
		}
		await rm(directory, { recursive: true, force: true })
	}
	try {
		let tls: { key: Buffer; cert: Buffer } | undefined
		delete process.env['GRPC_DEFAULT_SSL_ROOTS_FILE_PATH']
		if (certificateName) {
			let key = join(directory, 'key.pem')
			let cert = join(directory, 'cert.pem')
			await execute(
				'openssl',
				[
					'req',
					'-x509',
					'-newkey',
					'rsa:2048',
					'-nodes',
					'-keyout',
					key,
					'-out',
					cert,
					'-subj',
					`/CN=${certificateName}`,
					'-addext',
					`subjectAltName=DNS:${certificateName}`,
					'-days',
					'1',
				],
				{ signal }
			)
			tls = { key: await readFile(key), cert: await readFile(cert) }
			if (trusted) {
				process.env['GRPC_DEFAULT_SSL_ROOTS_FILE_PATH'] = cert
			}
		}
		process.env['no_grpc_proxy'] = 'localhost'
		process.env['no_proxy'] = 'localhost'
		let calls = 0
		server = new Server(tls ? { tls } : {})
		server.add(
			{ probe: method },
			{
				probe(_request, context) {
					calls++
					return context.peer
				},
			}
		)
		let port = await server.listen('localhost:0')
		let worker = join(directory, 'worker.mjs')
		await writeFile(
			worker,
			`import assert from 'node:assert/strict'
import { once } from 'node:events'
import { readFileSync, writeFileSync } from 'node:fs'
import { setImmediate } from 'node:timers/promises'
import { Client, createServiceClient } from ${JSON.stringify(grpcEntry)}
process.channel.ref()
let authority = new URL(process.env.YDB_CONNECTION_STRING)
let caPath = process.env.GRPC_DEFAULT_SSL_ROOTS_FILE_PATH
let transport = new Client(authority, {
	tls: {
		servername: process.env.YDB_MEMORY_TLS_SERVERNAME,
		...(caPath && { ca: readFileSync(caPath) }),
	},
})
let client = createServiceClient({ probe: {
	path: '/memory.Proxy/Probe', requestStream: false, responseStream: false,
	requestSerialize: value => Buffer.from(value), responseDeserialize: value => Buffer.from(value).toString(),
} }, transport)
async function run() {
	try {
		let first = await client.probe('ping')
		let disconnected = once(process, 'message')
		process.send({ type: 'disconnect' })
		await disconnected
		while (transport.state === 'ready') await setImmediate()
		await transport.connect()
		let second = await client.probe('ping')
		assert.notEqual(first, second, 'Disconnect did not replace the upstream TCP connection')
		writeFileSync(process.env.MEMORY_REPORT_FILE, JSON.stringify({ node: process.version }))
	} finally {
		client.close()
		process.disconnect()
	}
}
run().catch(error => { console.error(error); process.exitCode = 1 })
`
		)
		return {
			connectionString: `${certificateName ? 'grpcs' : 'grpc'}://localhost:${port}/local`,
			worker,
			report: join(directory, 'report.json'),
			get calls() {
				return calls
			},
			[Symbol.asyncDispose]: dispose,
		}
	} catch (error) {
		await dispose()
		throw error
	}
}

test('cuts plaintext memory worker connections despite inherited proxy exclusions', async (tc) => {
	await using fixture = await proxyFixture(tc.signal)
	let result = await runMemoryProfile(
		fixture.connectionString,
		fixture.worker,
		fixture.report,
		tc.signal
	)
	expect(result.cuts).toBe(1)
	expect(fixture.calls).toBe(2)
})

test('preserves TLS server identity when cutting memory worker connections', async (tc) => {
	await using fixture = await proxyFixture(tc.signal, 'localhost')
	let result = await runMemoryProfile(
		fixture.connectionString,
		fixture.worker,
		fixture.report,
		tc.signal
	)
	expect(result.cuts).toBe(1)
	expect(fixture.calls).toBe(2)
})

test('rejects a trusted certificate for the wrong memory upstream hostname', async (tc) => {
	await using fixture = await proxyFixture(tc.signal, 'wrong.example')
	await expect(
		runMemoryProfile(fixture.connectionString, fixture.worker, fixture.report, tc.signal)
	).rejects.toThrow(/Hostname\/IP does not match certificate/)
	expect(fixture.calls).toBe(0)
})

test('rejects an untrusted memory upstream certificate', async (tc) => {
	await using fixture = await proxyFixture(tc.signal, 'localhost', false)
	await expect(
		runMemoryProfile(fixture.connectionString, fixture.worker, fixture.report, tc.signal)
	).rejects.toThrow(/self-signed certificate/)
	expect(fixture.calls).toBe(0)
})
