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
        q.error(new Error('test'));

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

        q.error(new Error('test'));

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

    it('push stays ok after an error', async () => {
        q.error(new Error('test'));
        q.push(12);
    });

    it('restriction: only one instance of generator is allowed', async () => {
        q.end();
        for await (const _ of q);

        await expect(async () => {
            for await (const _ of q);
        }).rejects.toThrowError(new Error('Сan be only ONE instance of the generator'));
    });

    it('restriction: no call of push() or end() after end()', async () => {
        q.end();

        await expect(async () => {
            q.push(12);
        }).rejects.toThrowError(new Error('The queue has already been closed by calling end()'));

        await expect(async () => {
            q.end();
        }).rejects.toThrowError(new Error('The queue has already been closed by calling end()'));
    });
});


