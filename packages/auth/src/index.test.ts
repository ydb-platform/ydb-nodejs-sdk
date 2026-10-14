import { create } from '@bufbuild/protobuf'
import {
	DiscoveryServiceDefinition,
	type WhoAmIResponse,
	WhoAmIResponseSchema,
} from '@ydbjs/api/discovery'
import { Metadata, credentials, makeClientConstructor, status } from '@grpc/grpc-js'
import type { ServiceClient } from '@ydbjs/api/client'
import { unaryCall } from '@ydbjs/api/stream'
import { createServer } from 'nice-grpc'
import { expect, test } from 'vitest'

import { CredentialsProvider } from './index.ts'

// A controllable provider isolates cancellation during token acquisition from server timing.
async function fixture(getToken: CredentialsProvider['getToken']) {
	class Provider extends CredentialsProvider {
		override getToken = getToken
	}

	let server = createServer()
	let received: Record<string, string | undefined> | undefined
	server.add(
		{ whoAmI: DiscoveryServiceDefinition.whoAmI },
		{
			async whoAmI(_request, context) {
				received = {
					token: context.metadata.get('x-ydb-auth-ticket'),
					existing: context.metadata.get('x-existing'),
				}
				return create(WhoAmIResponseSchema, {})
			},
		}
	)

	let port = await server.listen('127.0.0.1:0')
	let Client = makeClientConstructor(DiscoveryServiceDefinition, 'DiscoveryService')
	let client = new Client(`127.0.0.1:${port}`, credentials.createInsecure(), {
		interceptors: [new Provider().interceptor],
	}) as unknown as ServiceClient<typeof DiscoveryServiceDefinition>

	return {
		client,
		get received() {
			return received
		},
		async [Symbol.asyncDispose]() {
			client.close()
			await server.shutdown()
		},
	}
}

test('attaches credentials while preserving caller metadata', async (tc) => {
	await using server = await fixture(async () => 'secret-token')
	let metadata = new Metadata()
	metadata.set('x-existing', 'value')
	metadata.set('x-ydb-auth-ticket', 'stale-token')

	await unaryCall<WhoAmIResponse>(
		(callback) => server.client.whoAmI({}, metadata, callback),
		tc.signal
	)

	expect(server.received).toEqual({ token: 'secret-token', existing: 'value' })
	expect(metadata.getMap()).toEqual({ 'x-existing': 'value', 'x-ydb-auth-ticket': 'stale-token' })
})

test('cancels a call while its credentials provider is pending', async () => {
	let started = Promise.withResolvers<void>()
	let pending = Promise.withResolvers<string>()
	let providerSignal: AbortSignal | undefined
	await using server = await fixture((_force, signal) => {
		providerSignal = signal
		started.resolve()
		return pending.promise
	})
	let controller = new AbortController()
	let response = unaryCall<WhoAmIResponse>(
		(callback) => server.client.whoAmI({}, callback),
		controller.signal
	)
	await started.promise

	controller.abort(new Error('cancelled by caller'))
	await expect(response).rejects.toThrow('cancelled by caller')

	expect(providerSignal?.aborted).toBe(true)
	pending.resolve('late-token')
	await new Promise((resolve) => setImmediate(resolve))
	expect(server.received).toBeUndefined()
})

test('honors a native deadline while its credentials provider ignores cancellation', async () => {
	let providerSignal: AbortSignal | undefined
	await using server = await fixture((_force, signal) => {
		providerSignal = signal
		return new Promise(() => {})
	})

	await expect(
		unaryCall<WhoAmIResponse>((callback) =>
			server.client.whoAmI({}, { deadline: Date.now() + 30 }, callback)
		)
	).rejects.toMatchObject({ code: status.DEADLINE_EXCEEDED })

	expect(providerSignal?.aborted).toBe(true)
	expect(server.received).toBeUndefined()
})

test('reports provider failures without sending an unauthenticated RPC', async (tc) => {
	await using server = await fixture(async () => {
		throw new Error('token unavailable')
	})

	await expect(
		unaryCall<WhoAmIResponse>((callback) => server.client.whoAmI({}, callback), tc.signal)
	).rejects.toMatchObject({
		code: status.UNKNOWN,
		details: expect.stringContaining('token unavailable'),
	})

	expect(server.received).toBeUndefined()
})

test('preserves native per-call credentials alongside the YDB token', async (tc) => {
	await using server = await fixture(async () => 'secret-token')
	let extraCredentials = credentials.createFromMetadataGenerator((_params, callback) => {
		let metadata = new Metadata()
		metadata.set('x-existing', 'native-credential')
		callback(null, metadata)
	})

	await unaryCall<WhoAmIResponse>(
		(callback) => server.client.whoAmI({}, { credentials: extraCredentials }, callback),
		tc.signal
	)

	expect(server.received).toEqual({ token: 'secret-token', existing: 'native-credential' })
})
