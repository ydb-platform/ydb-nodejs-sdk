import { Metadata as GrpcMetadata } from '@grpc/grpc-js'
import {
	ClientError as PreviousClientError,
	type ClientMiddleware as PreviousClientMiddleware,
	Metadata as PreviousMetadata,
} from 'nice-grpc'
import { expect, expectTypeOf, test } from 'vitest'

import { normalizeServiceDefinition } from './definition.js'
import { ClientError, Status, wrapClientError } from './error.js'
import { Metadata, fromGrpcMetadata, toGrpcMetadata } from './metadata.js'
import type { Client, ClientMiddleware } from './types.js'

test('preserves scalar text metadata and repeated binary metadata', () => {
	let bytes = new Uint8Array([1, 2, 3])
	let metadata = Metadata({ 'X-Label': ['first', 'second'], 'trace-bin': bytes })

	expect(metadata.append('x-label', 'third')).toBe(metadata)
	expect(metadata.get('X-LABEL')).toBe('first, second, third')
	expect(metadata.getAll('x-label')).toEqual(['first, second, third'])
	expect(metadata.append('TRACE-BIN', bytes).getAll('trace-bin')).toEqual([bytes, bytes])
	expect(metadata.has('TRACE-BIN')).toBe(true)

	metadata.set('x-label', [])
	metadata.delete('trace-bin')
	expect([...metadata]).toEqual([])
	expect(metadata.get('x-label')).toBeUndefined()
})

test('constructs metadata from existing middleware metadata without mutating it', () => {
	let previous = PreviousMetadata({ 'x-label': 'first' })
	let metadata = new Metadata(previous)

	metadata.append('x-label', 'second')
	expect(previous.get('x-label')).toBe('first')
	expect(metadata.get('x-label')).toBe('first, second')
	expect(PreviousMetadata(metadata).get('x-label')).toBe('first, second')
})

test('rejects invalid metadata keys and values', () => {
	let metadata = Metadata()

	expect(() => metadata.set('bad key', 'value')).toThrow('illegal characters')
	expect(() => metadata.set('label', 'line\nbreak')).toThrow('illegal characters')
	// @ts-expect-error Binary headers require bytes at runtime as well as in TypeScript.
	expect(() => metadata.set('label-bin', 'value')).toThrow('must have binary value')
	// @ts-expect-error Text headers require strings at runtime as well as in TypeScript.
	expect(() => metadata.set('label', new Uint8Array())).toThrow('must have string value')
})

test('round trips transport metadata and snapshots outgoing binary values', () => {
	let bytes = new Uint8Array([1, 2, 3])
	let metadata = Metadata({ 'x-label': ['first', 'second'], 'trace-bin': [bytes, bytes] })
	let transport = toGrpcMetadata(metadata)

	bytes[0] = 9
	expect(transport.get('trace-bin')).toEqual([Buffer.from([1, 2, 3]), Buffer.from([1, 2, 3])])

	let received = fromGrpcMetadata(transport)
	expect(received.get('x-label')).toBe('first, second')
	expect(received.getAll('trace-bin')).toEqual(transport.get('trace-bin'))
})

test('preserves error properties and old middleware instanceof checks', () => {
	let error = new ClientError('/test.Service/Call', Status.UNAVAILABLE, 'offline')
	let previous = new PreviousClientError('/test.Service/Call', Status.UNAVAILABLE, 'offline')

	expect(error).toBeInstanceOf(Error)
	expect(error).toBeInstanceOf(PreviousClientError)
	expect(previous).toBeInstanceOf(ClientError)
	expect(error).toMatchObject({
		name: 'ClientError',
		path: previous.path,
		code: previous.code,
		details: previous.details,
		message: previous.message,
	})

	class DerivedClientError extends ClientError {}
	expect(new DerivedClientError('/test', Status.UNKNOWN, '')).toBeInstanceOf(DerivedClientError)
	expect(error).not.toBeInstanceOf(DerivedClientError)
	expect({ code: Status.UNAVAILABLE }).not.toBeInstanceOf(ClientError)
})

test('wraps transport status errors while preserving application errors', () => {
	let statusError = Object.assign(new Error('transport'), {
		code: Status.UNAVAILABLE,
		details: 'offline',
		metadata: new GrpcMetadata(),
	})

	expect(wrapClientError(statusError, '/test')).toMatchObject({
		path: '/test',
		code: Status.UNAVAILABLE,
		details: 'offline',
	})

	let applicationError = new Error('application')
	expect(wrapClientError(applicationError, '/test')).toBe(applicationError)
	expect(wrapClientError(null, '/test')).toBeNull()
})

test('preserves existing middleware types structurally', () => {
	expectTypeOf<ClientMiddleware>().toExtend<PreviousClientMiddleware>()
	expectTypeOf<PreviousClientMiddleware>().toExtend<ClientMiddleware>()
})

test('normalizes ts-proto methods with partial requests and preserves their client types', () => {
	let message = {
		encode(value: { value: number }) {
			return { finish: () => new Uint8Array([value.value]) }
		},
		decode(bytes: Uint8Array) {
			return { value: bytes[0]! }
		},
		fromPartial(value: { value?: number }) {
			return { value: value.value ?? 7 }
		},
	}
	let service = {
		name: 'Service',
		fullName: 'test.Service',
		methods: {
			call: {
				name: 'Call',
				requestType: message,
				responseType: message,
				requestStream: false,
				responseStream: false,
				options: { idempotencyLevel: 'IDEMPOTENT' },
			},
		},
	} as const
	let method = normalizeServiceDefinition(service).call!

	expect(method.path).toBe('/test.Service/Call')
	expect(method.requestSerialize({})).toEqual(new Uint8Array([7]))
	expect(method.responseDeserialize(new Uint8Array([42]))).toEqual({ value: 42 })
	expect(method.options.idempotencyLevel).toBe('IDEMPOTENT')
	expectTypeOf<Client<typeof service>['call']>().toEqualTypeOf<
		(
			request: { value?: number },
			options?: import('./types.js').CallOptions
		) => Promise<{ value: number }>
	>()
})

test('ignores service labels and gives grpc-js methods an options descriptor', () => {
	let service = {
		call: {
			path: '/test.Service/Call',
			requestStream: false,
			responseStream: false,
			requestSerialize: (value: string) => Buffer.from(value),
			requestDeserialize: (bytes: Buffer) => bytes.toString(),
			responseSerialize: (value: string) => Buffer.from(value),
			responseDeserialize: (bytes: Buffer) => bytes.toString(),
		},
	}
	Object.assign(service, { name: 'Service', fullName: 'test.Service' })

	let methods = normalizeServiceDefinition(service)
	expect(Object.keys(methods)).toEqual(['call'])
	expect(methods.call!.options).toEqual({})
	expect(methods.call!.requestSerialize('hello')).toEqual(Buffer.from('hello'))
})

test('normalizes descriptors with serialization methods on their prototype', () => {
	class Method {
		path = '/test.Service/Call'
		requestStream = false as const
		responseStream = false as const
		encoding: BufferEncoding = 'utf8'
		requestSerialize(value: string) {
			return Buffer.from(value, this.encoding)
		}
		requestDeserialize(bytes: Buffer) {
			return bytes.toString(this.encoding)
		}
		responseSerialize(value: string) {
			return Buffer.from(value, this.encoding)
		}
		responseDeserialize(bytes: Buffer) {
			return bytes.toString(this.encoding)
		}
	}

	let method = normalizeServiceDefinition({ call: new Method() }).call!
	expect(method.requestSerialize('request')).toEqual(Buffer.from('request'))
	expect(method.requestDeserialize(Buffer.from('request'))).toBe('request')
	expect(method.responseSerialize('response')).toEqual(Buffer.from('response'))
	expect(method.responseDeserialize(Buffer.from('response'))).toBe('response')
})
