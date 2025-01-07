import type { TlsOptions } from "node:tls";
import { Driver } from './driver.js'

export interface YDBConnectionOptions {
    ssl?: TlsOptions
    token?: string | ((driver: Driver) => Promise<string>),
    balancer?: 'round_robin'
}

export default function ydb(connectionString: string, { } = {}) {

}
