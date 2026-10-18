import { CredentialsProvider } from '@ydbjs/auth'
import { AccessTokenCredentialsProvider } from '@ydbjs/auth/access-token'
import { DiscoveryServiceDefinition } from '@ydbjs/api/discovery'
import { type CallOptions, type Metadata, Server, Status } from '@ydbjs/grpc'
import { expect, test, vi } from 'vitest'

import { Driver } from './driver.js'
import { addMetadataHook } from './metadata-hooks.js'

class TestCredentials extends CredentialsProvider {
	async getToken(): Promise<string> {
		return 'test-token'
	}
}

test.for([-1, 0.5, NaN, Infinity, -Infinity, 0x1_0000_0000])(
	'rejects an invalid token timeout of %s ms',
	(timeout) => {
		let construct = () =>
			new Driver('grpc://127.0.0.1:1/local', {
				'ydb.sdk.enable_discovery': false,
				'ydb.sdk.token_timeout_ms': timeout,
			})

		expect(construct).toThrow(RangeError)
	}
)

// The loopback peer exposes headers that YDB does not return to the caller.
test('keeps mandatory headers and auth after caller metadata and metadata hooks', async (tc) => {
	let received: Metadata | undefined
	using server = new Server()
	server.add(
		{ whoAmI: DiscoveryServiceDefinition.whoAmI },
		{
			async whoAmI(_request, context) {
				received = context.metadata
				return {}
			},
		}
	)
	let port = await server.listen()
	using _ = addMetadataHook((metadata) => {
		metadata['x-hook'] = 'present'
		metadata['X-YDB-DATABASE'] = '/hook-database'
		metadata['X-YDB-AUTH-TICKET'] = 'hook-token'
	})
	using driver = new Driver(`grpc://127.0.0.1:${port}/local`, {
		'ydb.sdk.enable_discovery': false,
		credentialsProvider: new TestCredentials(),
	})
	let metadata = Object.freeze({
		'x-caller': 'present',
		'x-ydb-database': '/caller',
		'x-ydb-auth-ticket': 'caller-token',
	})
	let options = Object.freeze({ signal: tc.signal, metadata })
	let client = driver.createClient(DiscoveryServiceDefinition)

	await client.whoAmI({}, options)

	expect(received?.['x-hook']).toBe('present')
	expect(received?.['x-caller']).toBe('present')
	expect(received?.['x-ydb-auth-ticket']).toBe('test-token')
	expect(received?.['x-ydb-database']).toBe('/local')
	expect(received?.['x-ydb-sdk-build-info']).toEqual(expect.any(String))
	expect(received?.['x-ydb-application-name']).toBe(driver.application)
	expect(options.metadata).toBe(metadata)
})

test('keeps registered metadata hooks in an existing driver after registration disposal', async (tc) => {
	let observed: Array<Metadata[string] | undefined> = []
	using server = new Server()
	server.add(
		{ whoAmI: DiscoveryServiceDefinition.whoAmI },
		{
			async whoAmI(_request, context) {
				observed.push(context.metadata['x-snapshot'])
				return {}
			},
		}
	)
	let port = await server.listen()
	let registration = addMetadataHook((metadata) => {
		metadata['x-snapshot'] = 'retained'
	})
	using first = new Driver(`grpc://127.0.0.1:${port}/local`, {
		'ydb.sdk.enable_discovery': false,
	})
	registration[Symbol.dispose]()
	using second = new Driver(`grpc://127.0.0.1:${port}/local`, {
		'ydb.sdk.enable_discovery': false,
	})

	let firstClient = first.createClient(DiscoveryServiceDefinition)
	let secondClient = second.createClient(DiscoveryServiceDefinition)

	await firstClient.whoAmI({}, { signal: tc.signal })
	await secondClient.whoAmI({}, { signal: tc.signal })

	expect(observed).toEqual(['retained', undefined])
})

test('cancels only the token wait before opening an RPC', async (tc) => {
	let entered = Promise.withResolvers<void>()
	let token = Promise.withResolvers<string>()
	let calls = 0
	using server = new Server()
	server.add(
		{ whoAmI: DiscoveryServiceDefinition.whoAmI },
		{
			async whoAmI() {
				calls++
				return {}
			},
		}
	)
	let port = await server.listen()
	let providerSignal: AbortSignal | undefined
	class PendingCredentials extends CredentialsProvider {
		getToken(_force?: boolean, signal?: AbortSignal): Promise<string> {
			providerSignal = signal
			entered.resolve()
			return token.promise
		}
	}
	using driver = new Driver(`grpc://127.0.0.1:${port}/local`, {
		'ydb.sdk.enable_discovery': false,
		credentialsProvider: new PendingCredentials(),
		'ydb.sdk.token_timeout_ms': 1000,
	})
	let controller = new AbortController()
	let reason = new Error('caller cancelled token wait')
	let signal = AbortSignal.any([tc.signal, controller.signal])
	let client = driver.createClient(DiscoveryServiceDefinition)

	let pending = client.whoAmI({}, { signal, deadline: Date.now() + 5000 })
	await entered.promise

	controller.abort(reason)

	await expect(pending).rejects.toBe(reason)
	expect(providerSignal).toBeUndefined()
	token.resolve('late-token')
	await new Promise<void>((resolve) => setImmediate(resolve))
	expect(calls).toBe(0)
})

test('preserves caller cancellation when the provider later rejects', async (tc) => {
	let entered = Promise.withResolvers<void>()
	let providerSignal: AbortSignal | undefined
	let providerError = new DOMException('Token request aborted', 'AbortError')
	let token = Promise.withResolvers<string>()
	class CancellableCredentials extends CredentialsProvider {
		getToken(_force?: boolean, signal?: AbortSignal): Promise<string> {
			providerSignal = signal
			entered.resolve()
			return token.promise
		}
	}
	using driver = new Driver('grpc://127.0.0.1:1/local', {
		'ydb.sdk.enable_discovery': false,
		'ydb.sdk.token_timeout_ms': 1000,
		credentialsProvider: new CancellableCredentials(),
	})
	let controller = new AbortController()
	let reason = new Error('Caller cancelled authentication')
	let signal = AbortSignal.any([tc.signal, controller.signal])
	let client = driver.createClient(DiscoveryServiceDefinition)
	let pending = client.whoAmI({}, { signal, deadline: Date.now() + 5000 })
	await entered.promise

	controller.abort(reason)

	await expect(pending).rejects.toBe(reason)
	expect(providerSignal).toBeUndefined()
	token.reject(providerError)
	await new Promise<void>((resolve) => setImmediate(resolve))
	await expect(pending).rejects.toBe(reason)
})

test('applies the RPC deadline while credentials are pending', async (tc) => {
	let providerSignal: AbortSignal | undefined
	class PendingCredentials extends CredentialsProvider {
		getToken(_force?: boolean, signal?: AbortSignal): Promise<string> {
			providerSignal = signal
			return new Promise(() => {})
		}
	}
	using driver = new Driver('grpc://127.0.0.1:1/local', {
		'ydb.sdk.enable_discovery': false,
		credentialsProvider: new PendingCredentials(),
		'ydb.sdk.token_timeout_ms': 1000,
	})
	let client = driver.createClient(DiscoveryServiceDefinition)

	let pending = client.whoAmI({}, { signal: tc.signal, deadline: Date.now() + 30 })

	await expect(pending).rejects.toMatchObject({ code: Status.DEADLINE_EXCEEDED })
	expect(providerSignal).toBeUndefined()
})

test.for([
	{ deadlineMs: undefined, scenario: 'without an RPC deadline' },
	{ deadlineMs: 1000, scenario: 'before a longer RPC deadline' },
])('expires a pending token request $scenario', async ({ deadlineMs }, tc) => {
	let entered = Promise.withResolvers<void>()
	let token = Promise.withResolvers<string>()
	let providerSignal: AbortSignal | undefined
	class PendingCredentials extends CredentialsProvider {
		getToken(_force?: boolean, signal?: AbortSignal): Promise<string> {
			providerSignal = signal
			entered.resolve()
			return token.promise
		}
	}
	let calls = 0
	using server = new Server()
	server.add(
		{ whoAmI: DiscoveryServiceDefinition.whoAmI },
		{
			async whoAmI() {
				calls++
				return {}
			},
		}
	)
	let port = await server.listen()
	vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
	tc.onTestFinished(() => {
		vi.useRealTimers()
	})
	using driver = new Driver(`grpc://127.0.0.1:${port}/local`, {
		'ydb.sdk.enable_discovery': false,
		'ydb.sdk.token_timeout_ms': 100,
		credentialsProvider: new PendingCredentials(),
	})
	let client = driver.createClient(DiscoveryServiceDefinition)
	let options: CallOptions = { signal: tc.signal }
	if (deadlineMs !== undefined) options.deadline = Date.now() + deadlineMs
	let pending = client.whoAmI({}, options)
	let settled = false
	let failure = pending.then(
		() => {
			settled = true
			return undefined
		},
		(error: unknown) => {
			settled = true
			return error
		}
	)
	await entered.promise

	await vi.advanceTimersByTimeAsync(99)
	expect(settled).toBe(false)
	expect(providerSignal).toBeUndefined()
	await vi.advanceTimersByTimeAsync(1)
	expect(settled).toBe(true)
	expect(providerSignal).toBeUndefined()
	expect(await failure).toMatchObject({ code: Status.DEADLINE_EXCEEDED })

	token.resolve('late-token')
	await new Promise<void>((resolve) => setImmediate(resolve))
	expect(calls).toBe(0)
})

test('keeps the original RPC deadline after waiting for credentials', async (tc) => {
	let authenticating = Promise.withResolvers<void>()
	let token = Promise.withResolvers<string>()
	class PendingCredentials extends CredentialsProvider {
		getToken(): Promise<string> {
			authenticating.resolve()
			return token.promise
		}
	}
	let received = Promise.withResolvers<number | undefined>()
	let response = Promise.withResolvers<void>()
	using server = new Server()
	server.add(
		{ whoAmI: DiscoveryServiceDefinition.whoAmI },
		{
			async whoAmI(_request, context) {
				received.resolve(context.deadline)
				await response.promise
				return {}
			},
		}
	)
	let port = await server.listen()
	vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
	tc.onTestFinished(() => {
		vi.useRealTimers()
	})
	using driver = new Driver(`grpc://127.0.0.1:${port}/local`, {
		'ydb.sdk.enable_discovery': false,
		'ydb.sdk.token_timeout_ms': 800,
		credentialsProvider: new PendingCredentials(),
	})
	let client = driver.createClient(DiscoveryServiceDefinition)
	let deadline = Date.now() + 1000
	let settled = false
	let pending = client.whoAmI({}, { signal: tc.signal, deadline })
	let failure = pending.then(
		() => {
			settled = true
			return undefined
		},
		(error: unknown) => {
			settled = true
			return error
		}
	)
	await authenticating.promise
	await vi.advanceTimersByTimeAsync(600)
	token.resolve('test-token')

	expect(await received.promise).toBe(deadline)
	await vi.advanceTimersByTimeAsync(399)
	expect(settled).toBe(false)
	await vi.advanceTimersByTimeAsync(1)
	expect(settled).toBe(true)
	expect(await failure).toMatchObject({ code: Status.DEADLINE_EXCEEDED })
	response.resolve()
})

test('does not allocate a token timer for an already available access token', async (tc) => {
	let received: Metadata | undefined
	using server = new Server()
	server.add(
		{ whoAmI: DiscoveryServiceDefinition.whoAmI },
		{
			async whoAmI(_request, context) {
				received = context.metadata
				return {}
			},
		}
	)
	let port = await server.listen()
	vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
	tc.onTestFinished(() => {
		vi.useRealTimers()
	})
	using timeouts = vi.spyOn(globalThis, 'setTimeout')
	let tokenTimeout = 1234
	using driver = new Driver(`grpc://127.0.0.1:${port}/local`, {
		'ydb.sdk.enable_discovery': false,
		'ydb.sdk.token_timeout_ms': tokenTimeout,
		credentialsProvider: new AccessTokenCredentialsProvider({ token: 'cached-token' }),
	})
	let client = driver.createClient(DiscoveryServiceDefinition)

	await client.whoAmI({}, { signal: tc.signal })

	let tokenTimers = timeouts.mock.calls.filter(([, delay]) => delay === tokenTimeout)
	expect(tokenTimers).toHaveLength(0)
	expect(received?.['x-ydb-auth-ticket']).toBe('cached-token')
})

test('stops the token timer after authentication without shortening the RPC', async (tc) => {
	let providerSignal: AbortSignal | undefined
	class RefreshingCredentials extends CredentialsProvider {
		async getToken(_force?: boolean, signal?: AbortSignal): Promise<string> {
			providerSignal = signal
			return 'cached-token'
		}
	}
	let received = Promise.withResolvers<void>()
	let response = Promise.withResolvers<void>()
	using server = new Server()
	server.add(
		{ whoAmI: DiscoveryServiceDefinition.whoAmI },
		{
			async whoAmI() {
				received.resolve()
				await response.promise
				return {}
			},
		}
	)
	let port = await server.listen()
	vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
	tc.onTestFinished(() => {
		vi.useRealTimers()
	})
	using driver = new Driver(`grpc://127.0.0.1:${port}/local`, {
		'ydb.sdk.enable_discovery': false,
		'ydb.sdk.token_timeout_ms': 100,
		credentialsProvider: new RefreshingCredentials(),
	})
	let controller = new AbortController()
	let signal = AbortSignal.any([tc.signal, controller.signal])
	let client = driver.createClient(DiscoveryServiceDefinition)
	let pending = client.whoAmI({}, { signal, deadline: Date.now() + 1000 })
	await received.promise

	await vi.advanceTimersByTimeAsync(500)
	expect(providerSignal).toBeUndefined()
	response.resolve()
	await pending
	controller.abort(new Error('caller finished'))
	driver.close()

	expect(providerSignal).toBeUndefined()
})

test.for(['synchronous', 'asynchronous'])(
	'reports a %s credential failure without opening an RPC',
	async (kind, tc) => {
		let calls = 0
		let failure = new Error('token unavailable')
		let providerSignal: AbortSignal | undefined
		class FailingCredentials extends CredentialsProvider {
			getToken(_force?: boolean, signal?: AbortSignal): Promise<string> {
				providerSignal = signal
				if (kind === 'synchronous') throw failure
				return Promise.reject(failure)
			}
		}
		using server = new Server()
		server.add(
			{ whoAmI: DiscoveryServiceDefinition.whoAmI },
			{
				async whoAmI() {
					calls++
					return {}
				},
			}
		)
		let port = await server.listen()
		vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
		tc.onTestFinished(() => {
			vi.useRealTimers()
		})
		using driver = new Driver(`grpc://127.0.0.1:${port}/local`, {
			'ydb.sdk.enable_discovery': false,
			'ydb.sdk.token_timeout_ms': 100,
			credentialsProvider: new FailingCredentials(),
		})
		let client = driver.createClient(DiscoveryServiceDefinition)

		let pending = client.whoAmI({}, { signal: tc.signal })

		await expect(pending).rejects.toBe(failure)
		await vi.advanceTimersByTimeAsync(200)
		driver.close()

		expect(providerSignal).toBeUndefined()
		expect(calls).toBe(0)
	}
)

test.for(['resolve', 'reject', 'throw'])(
	'preserves cancellation during a synchronous provider %s',
	async (outcome, tc) => {
		let caller = new AbortController()
		let reason = new Error('Caller cancelled during token acquisition')
		let providerError = new Error('Provider failed')
		class CancellingCredentials extends CredentialsProvider {
			getToken(): Promise<string> {
				caller.abort(reason)
				if (outcome === 'throw') throw providerError
				return outcome === 'reject'
					? Promise.reject(providerError)
					: Promise.resolve('token')
			}
		}
		using driver = new Driver('grpc://127.0.0.1:1/local', {
			'ydb.sdk.enable_discovery': false,
			credentialsProvider: new CancellingCredentials(),
		})
		let client = driver.createClient(DiscoveryServiceDefinition)
		let signal = AbortSignal.any([tc.signal, caller.signal])
		let pending = client.whoAmI({}, { signal })

		await expect(pending).rejects.toBe(reason)
		await new Promise<void>((resolve) => setImmediate(resolve))
	}
)
