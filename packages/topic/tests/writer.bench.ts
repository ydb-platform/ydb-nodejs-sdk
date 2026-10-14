import { unaryCall } from '@ydbjs/api/stream'
import {
	CreateTopicRequestSchema,
	type CreateTopicResponse,
	DropTopicRequestSchema,
	type DropTopicResponse,
	TopicServiceDefinition,
} from '@ydbjs/api/topic'
import { bench, inject } from 'vitest'

import { create } from '@bufbuild/protobuf'
import { Driver } from '@ydbjs/core'
import { type TopicWriter, createTopicWriter } from '../src/writer/index.js'

// Total traffic to send in bytes (128 MiB - reduced to avoid rate limits)
const TOTAL_TRAFFIC_BYTES = 128 * 1024 * 1024

// @ts-ignore
let driver = new Driver(inject('connectionString'), {
	'ydb.sdk.enable_discovery': false,
})
await driver.ready()

// Generate unique topic name for each test
let writer: TopicWriter
let testTopicName: string
let testConsumerName: string

async function setup() {
	testTopicName = `test-topic-bench-${Date.now()}`
	testConsumerName = `test-consumer-${Date.now()}`

	await unaryCall<CreateTopicResponse>((callback) =>
		driver.createClient(TopicServiceDefinition).createTopic(
			create(CreateTopicRequestSchema, {
				path: testTopicName,
				partitioningSettings: {
					minActivePartitions: 1n,
					maxActivePartitions: 100n,
				},
				consumers: [
					{
						name: testConsumerName,
					},
				],
			}),
			callback
		)
	)

	writer = createTopicWriter(driver, {
		topic: testTopicName,
		maxBufferBytes: 1024n * 1024n * 1024n, // 1GB
	})
}

async function teardown() {
	writer.destroy()

	await unaryCall<DropTopicResponse>((callback) =>
		driver.createClient(TopicServiceDefinition).dropTopic(
			create(DropTopicRequestSchema, {
				path: testTopicName,
			}),
			callback
		)
	)
}

bench(
	'16KiB',
	async () => {
		let MESSAGE_SIZE = 16 * 1024
		let payload = new Uint8Array(MESSAGE_SIZE)

		for (let i = 0; i < TOTAL_TRAFFIC_BYTES / MESSAGE_SIZE; i++) {
			writer.write(payload)
		}

		await writer.flush()
	},
	{ warmupIterations: 0, setup, teardown }
)

bench(
	'64KiB',
	async () => {
		let MESSAGE_SIZE = 64 * 1024
		let payload = new Uint8Array(MESSAGE_SIZE)

		for (let i = 0; i < TOTAL_TRAFFIC_BYTES / MESSAGE_SIZE; i++) {
			writer.write(payload)
		}

		await writer.flush()
	},
	{ warmupIterations: 0, setup, teardown }
)

bench(
	'256KiB',
	async () => {
		let MESSAGE_SIZE = 256 * 1024
		let payload = new Uint8Array(MESSAGE_SIZE)

		for (let i = 0; i < TOTAL_TRAFFIC_BYTES / MESSAGE_SIZE; i++) {
			writer.write(payload)
		}

		await writer.flush()
	},
	{ warmupIterations: 0, setup, teardown }
)

bench(
	'1MiB',
	async () => {
		let MESSAGE_SIZE = 1 * 1024 * 1024
		let payload = new Uint8Array(MESSAGE_SIZE)

		for (let i = 0; i < TOTAL_TRAFFIC_BYTES / MESSAGE_SIZE; i++) {
			writer.write(payload)
		}

		await writer.flush()
	},
	{ warmupIterations: 0, setup, teardown }
)
