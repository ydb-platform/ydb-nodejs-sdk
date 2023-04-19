export const TABLE_NAME = 'slo-test'
export const TABLE_MIN_PARTITION_COUNT = 6
export const TABLE_MAX_PARTITION_COUNT = 1000
export const TABLE_PARTITION_SIZE = 1

export const GENERATOR_DATA_COUNT = 1000
export const GENERATOR_PACK_SIZE = 100

export const READ_RPS = 1000
export const READ_TIMEOUT = 70 // milliseconds
export const READ_TIME = 360 // seconds

export const WRITE_RPS = 1000
export const WRITE_TIMEOUT = 20000 // milliseconds
export const WRITE_TIME = 360 // seconds

export const SHUTDOWN_TIME = 30
export const PROMETHEUS_PUSH_GATEWAY = 'http://127.0.0.1:9091'
export const PROMETHEUS_PUSH_PERIOD = 250
