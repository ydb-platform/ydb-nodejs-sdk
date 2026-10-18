import { create } from '@bufbuild/protobuf'
import { anyPack } from '@bufbuild/protobuf/wkt'
import { abortable } from '@ydbjs/abortable'
import { AuthServiceDefinition, LoginResponseSchema, LoginResultSchema } from '@ydbjs/api/auth'
import { StatusIds_StatusCode } from '@ydbjs/api/operation'
import { Server } from '@ydbjs/grpc'
import { expect, test, vi } from 'vitest'

import { StaticCredentialsProvider } from './static.ts'

// Controlled login responses avoid clock races around soft expiry and in-flight refreshes.
function loginResponse(expiresIn = 600) {
	let payload = Buffer.from(JSON.stringify({ exp: Date.now() / 1000 + expiresIn })).toString(
		'base64url'
	)
	let token = `header.${payload}.signature`
	return create(LoginResponseSchema, {
		operation: {
			ready: true,
			status: StatusIds_StatusCode.SUCCESS,
			result: anyPack(LoginResultSchema, create(LoginResultSchema, { token })),
		},
	})
}

test('allocates no default timeout for caller signals or cached tokens', async (tc) => {
	using server = new Server()
	let logins = 0
	server.add(
		{ login: AuthServiceDefinition.login },
		{
			async login() {
				logins++
				return loginResponse()
			},
		}
	)
	let port = await server.listen('127.0.0.1:0')
	let provider = new StaticCredentialsProvider(
		{ username: 'test', password: 'test' },
		`grpc://127.0.0.1:${port}`
	)
	using timeout = vi.spyOn(AbortSignal, 'timeout')

	let token = await provider.getToken(false, tc.signal)
	expect(await provider.getToken()).toBe(token)
	expect(await provider.getToken()).toBe(token)
	expect(timeout).not.toHaveBeenCalled()
	expect(logins).toBe(1)
})

test('allocates one default timeout when concurrent calls share a refresh', async (tc) => {
	using server = new Server()
	let started = Promise.withResolvers<void>()
	let release = Promise.withResolvers<void>()
	let logins = 0
	server.add(
		{ login: AuthServiceDefinition.login },
		{
			async login(_request, context) {
				logins++
				started.resolve()
				await abortable(context.signal, release.promise)
				return loginResponse()
			},
		}
	)
	let port = await server.listen('127.0.0.1:0')
	let provider = new StaticCredentialsProvider(
		{ username: 'test', password: 'test' },
		`grpc://127.0.0.1:${port}`
	)
	using timeout = vi.spyOn(AbortSignal, 'timeout')

	let tokens = Promise.all([provider.getToken(), provider.getToken(), provider.getToken()])
	void tokens.catch(() => {})
	await abortable(tc.signal, started.promise)
	expect(timeout.mock.calls).toEqual([[5000]])
	expect(logins).toBe(1)
	release.resolve()
	let [first, second, third] = await tokens
	expect(second).toBe(first)
	expect(third).toBe(first)
})

test('allocates background refresh timeouts only for the call that starts it', async (tc) => {
	using server = new Server()
	let started = Promise.withResolvers<void>()
	let release = Promise.withResolvers<void>()
	let logins = 0
	server.add(
		{ login: AuthServiceDefinition.login },
		{
			async login(_request, context) {
				logins++
				if (logins === 2) {
					started.resolve()
					await abortable(context.signal, release.promise)
				}
				return loginResponse(logins === 1 ? 90 : 600)
			},
		}
	)
	let port = await server.listen('127.0.0.1:0')
	let provider = new StaticCredentialsProvider(
		{ username: 'test', password: 'test' },
		`grpc://127.0.0.1:${port}`
	)
	let token = await provider.getToken(false, tc.signal)
	using timeout = vi.spyOn(AbortSignal, 'timeout')

	expect(await provider.getToken()).toBe(token)
	await abortable(tc.signal, started.promise)
	expect(await provider.getToken()).toBe(token)
	expect(await provider.getToken()).toBe(token)
	expect(timeout.mock.calls).toEqual([[5000], [30000]])
	expect(logins).toBe(2)
	let refreshed = provider.getToken(true, tc.signal)
	release.resolve()
	expect(await refreshed).not.toBe(token)
	expect(await provider.getToken()).not.toBe(token)
	expect(timeout.mock.calls).toEqual([[5000], [30000]])
})
