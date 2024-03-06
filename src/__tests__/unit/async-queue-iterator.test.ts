import {buildAsyncQueueIterator, IAsyncQueueIterator} from '../../utils/build-async-queue-iterator';

describe('asyncQueueIterator', () => {

    let q: IAsyncQueueIterator<number>;

    beforeEach(() => {
        q = buildAsyncQueueIterator<number>();
    });

    it('push first then dequeue', async () => {
        for (let n = 0; n < 4; n++) q.push(n);
        q.end();

        const arr = [];
        for await (const v of q) arr.push(v);

        expect(arr).toEqual([0, 1, 2, 3]);
    });

    it('dequeue first then data received', async () => {
        const arr: number[] = [];
        const readerPromise = new Promise(async (resolve) => {
            for await (const v of q) arr.push(v);
            resolve(undefined);
        })

        for (let n = 0; n < 4; n++) q.push(n);
        q.end();

        await readerPromise;

        expect(arr).toEqual([0, 1, 2, 3]);
    });

    it('empty queue', async () => {
        q.end();

        const arr = [];
        for await (const v of q) arr.push(v);

        expect(arr).toEqual([]);
    });

    it('starts from error', async () => {
        q.end(new Error('test'));

        await expect(async () => {
            for await (const _ of q) expect(false).toBeTruthy()
        }).rejects.toThrowError(new Error('test'))
    });

    it('dequeue first then error', async () => {
        const w = new Promise(async (resolve) => {
            await expect(async () => {
                await q[Symbol.asyncIterator]().next();
            }).rejects.toThrowError(new Error('test'));
            resolve(undefined);
        });

        q.end(new Error('test'));

        await w;
    });

    it('dequeue first then the queue end', async () => {
        const w = new Promise(async (resolve) => {
            await expect((await q[Symbol.asyncIterator]().next()).done).toBeTruthy();
            resolve(undefined);
        });

        q.end();

        await w;
    });
});
