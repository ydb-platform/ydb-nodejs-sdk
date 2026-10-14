import {
	Channel,
	type ChannelCredentials,
	type ChannelOptions,
	Client as GrpcClient,
	credentials,
} from '@grpc/grpc-js'

import { normalizeServiceDefinition } from './definition.js'
import { invoke } from './transport.js'
import type {
	CallOptions,
	Client,
	ClientMiddleware,
	ClientMiddlewareCall,
	CompatServiceDefinition,
	DefaultCallOptions,
	NormalizedServiceDefinition,
} from './types.js'

export * from './types.js'
export { Metadata, type MetadataInit, type MetadataValue } from './metadata.js'
export { ClientError, Status } from './error.js'
export { Channel, ChannelCredentials, type ChannelOptions } from '@grpc/grpc-js'

export function createChannel(
	address: string,
	channelCredentials?: ChannelCredentials,
	options?: ChannelOptions
): Channel {
	let match = /^(?:([^:]+):\/\/)?(.*?)(?::(\d+))?$/.exec(address)
	if (!match) {
		throw new Error(`Invalid address: '${address}'`)
	}

	let [, protocol, host, port] = match
	// eslint-disable-next-line no-underscore-dangle -- This is grpc-js's public credential API.
	let secure = channelCredentials?._isSecure() || protocol === 'https'
	let target =
		!protocol || protocol === 'http' || protocol === 'https'
			? `${host}:${port ?? (secure ? '443' : '80')}`
			: address

	return new Channel(
		target,
		channelCredentials ?? (secure ? credentials.createSsl() : credentials.createInsecure()),
		options ?? {}
	)
}

export function composeClientMiddleware(
	first: ClientMiddleware,
	second: ClientMiddleware
): ClientMiddleware {
	return (call, options) =>
		second(
			{
				...call,
				next: (request: any, nextOptions: CallOptions) =>
					first({ ...call, request }, nextOptions),
			} as ClientMiddlewareCall<any, any>,
			options
		)
}

export function createClient<Service extends CompatServiceDefinition>(
	service: Service,
	channel: Channel,
	defaultOptions: DefaultCallOptions<NormalizedServiceDefinition<Service>> = {},
	middleware?: ClientMiddleware
): Client<Service> {
	let transport = new GrpcClient('', credentials.createInsecure(), { channelOverride: channel })
	let client: Record<string, unknown> = {}

	for (let [name, method] of Object.entries(normalizeServiceDefinition(service))) {
		let defaults = {
			...defaultOptions['*'],
			...defaultOptions[name as keyof typeof defaultOptions],
		}
		let next = (request: any, options: CallOptions) =>
			invoke(transport, method, request, options)
		let call = (request: any, options: CallOptions = {}) =>
			middleware
				? middleware(
						{
							method,
							requestStream: method.requestStream,
							responseStream: method.responseStream,
							request,
							next,
						} as ClientMiddlewareCall<any, any>,
						{ ...defaults, ...options }
					)
				: next(request, { ...defaults, ...options })

		client[name] = method.responseStream
			? (request: any, options?: CallOptions) => responses(call(request, options))
			: (request: any, options?: CallOptions) => response(call(request, options))
	}

	return client as Client<Service>
}

async function response(iterator: AsyncGenerator<any, any, undefined>): Promise<any> {
	let result = await iterator.next()
	while (!result.done || result.value == null) {
		// eslint-disable-next-line no-await-in-loop -- Middleware can handle a protocol violation and resume.
		result = await iterator.throw(
			new Error(
				result.done
					? 'A middleware returned void, but expected a response'
					: 'A middleware yielded a response, but expected to return it'
			)
		)
	}
	return result.value
}

async function* responses(
	iterator: AsyncGenerator<any, any, undefined>
): AsyncGenerator<any, void, undefined> {
	let result = yield* iterator
	if (result != null) {
		await iterator.throw(new Error('A middleware returned a response, but expected void'))
	}
}
