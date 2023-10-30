import EventEmitter from 'events';
import { SessionPool } from './session-pool';
import { Session } from './session';
import { ITableClientSettings } from './internal/i-table-client-settings';

export class TableClient extends EventEmitter {
    private pool: SessionPool;

    constructor(settings: ITableClientSettings) {
        super();
        this.pool = new SessionPool(settings);
    }

    public async withSession<T>(callback: (session: Session) => Promise<T>, timeout = 0): Promise<T> {
        return this.pool.withSession(callback, timeout);
    }

    public async withSessionRetry<T>(callback: (session: Session) => Promise<T>, timeout = 0, maxRetries = 10): Promise<T> {
        return this.pool.withSessionRetry(callback, timeout, maxRetries);
    }

    public async destroy() {
        await this.pool.destroy();
    }
}
