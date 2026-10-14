import { unaryCall } from '@ydbjs/api/stream'
import {
	CreateTopicRequestSchema,
	type CreateTopicResponse,
	DropTopicRequestSchema,
	type DropTopicResponse,
	TopicServiceDefinition,
} from '@ydbjs/api/topic'
import { workerData } from 'node:worker_threads'

import { create } from '@bufbuild/protobuf'
import { Driver } from '@ydbjs/core'

import { installSafetyHandlers } from '../../lib/safety.ts'
import type { WorkerData } from '../../lib/worker-api.ts'

installSafetyHandlers()

let { params } = workerData as WorkerData
let topic = params['topic'] ?? 'slo-topic'
let consumer = params['consumer'] ?? 'slo-consumer'
let partitions = parseInt(params['partitions'] ?? '10', 10)

{
	using driver = new Driver(process.env['YDB_CONNECTION_STRING']!)
	await driver.ready()
	let service = driver.createClient(TopicServiceDefinition)

	// Drop any leftover from a previous run (ignore "not found").
	try {
		await unaryCall<DropTopicResponse>((callback) =>
			service.dropTopic(create(DropTopicRequestSchema, { path: topic }), callback)
		)
	} catch {
		// topic did not exist
	}

	await unaryCall<CreateTopicResponse>((callback) =>
		service.createTopic(
			create(CreateTopicRequestSchema, {
				path: topic,
				partitioningSettings: {
					minActivePartitions: BigInt(partitions),
					maxActivePartitions: BigInt(partitions),
				},
				consumers: [{ name: consumer }],
			}),
			callback
		)
	)

	console.log(
		'[topic.setup] created %s (%d partitions, consumer %s)',
		topic,
		partitions,
		consumer
	)
}

process.exit(0)
