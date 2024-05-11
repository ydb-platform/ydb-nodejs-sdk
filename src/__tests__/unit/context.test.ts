// @ts-ignore
import {Context, setContextIdGenerator} from '../../context';
// @ts-ignore
import {ensureContext} from '../../context/ensureContext';
// @ts-ignore
import {cancelListenersSymbol, errSymbol} from '../../context/symbols';

describe('Context', () => {
    beforeEach(() => {
        setContextIdGenerator(); // back to default
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('id generation', () => {
        expect(Context.createNew().ctx.id).toBe('0001');
        expect(Context.createNew().ctx.toString()).toBe('0002');
        setContextIdGenerator(() => '');
        expect(Context.createNew().ctx.id).toBe('');
        expect(Context.createNew().ctx.id).toBe('');
    });

    it('simple', () => {
        const {ctx: ctx1, cancel: cancel1, dispose: dispose1, done: done1} =
            Context.createNew();
        expect(ctx1).toBeDefined();
        expect(ctx1.onCancel).toBeUndefined();
        expect(cancel1).toBeUndefined();
        expect(dispose1).toBeUndefined();
        expect(done1).toBeUndefined();

        const {ctx: ctx2, cancel: cancel2, dispose: dispose2, done: done2} =
            ctx1.createChild();
        expect(ctx2).toBeDefined();
        expect(ctx2.onCancel).toBeUndefined();
        expect(cancel2).toBeUndefined();
        expect(dispose2).toBeUndefined();
        expect(done2).toBeUndefined();

        expect(() => ctx1.createChild({id: '123'})).toThrow('This method cannot change the context id');
    });

    for (const mode of [
        'cancel1',
        'cancel2',
        'cancel3',
        'unsub',
        'dispose',
    ])
        it(`cancel; mode: ${mode}`, () => {
            const {ctx: ctx1, cancel: cancel1, dispose: dispose1, done: done1} =
                Context.createNew({cancel: true});
            expect(ctx1).toBeDefined();
            expect(ctx1.err).toBeUndefined();
            expect(ctx1.onCancel).toBeDefined(); // becuase was implicitly requested
            expect(cancel1).toBeDefined();
            expect(dispose1).toBeUndefined();
            expect(done1).toBeUndefined();

            const {ctx: ctx2, cancel: cancel2, dispose: dispose2, done: done2} =
                ctx1.createChild({cancel: true});
            expect(ctx2).toBeDefined();
            expect(ctx2.err).toBeUndefined();
            expect(ctx2.onCancel).toBeDefined(); // becuase was implicitly requested and parent has
            expect(cancel2).toBeDefined();
            expect(dispose2).toBeDefined(); // dispose cancel chain
            expect(done2).toBeUndefined();

            const {ctx: ctx3, cancel: cancel3, dispose: dispose3, done: done3} =
                ctx1.createChild({force: true});
            expect(ctx3).toBeDefined();
            expect(ctx3.err).toBeUndefined();
            expect(ctx3.onCancel).toBeDefined(); // because parent ctx has cancel
            expect(cancel3).toBeUndefined(); // cancel was not requested through options
            expect(dispose3).toBeDefined(); // dispose cancel
            expect(done3).toBeUndefined();

            const testCancel = new Error('Test cancel');
            let cnt1 = 0, cnt2 = 0, cnt3 = 0;
            const unsub1 = ctx1.onCancel!((cause) => {
                cnt1++;
                expect(cause!.message).toBe('Test cancel');
            });
            const unsub2 = ctx2.onCancel!((cause) => {
                cnt2++;
                expect(cause!.message).toBe('Test cancel');
            });
            const unsub3 = ctx3.onCancel!((cause) => {
                cnt3++;
                expect(cause!.message).toBe('Test cancel');
            });

            expect(ctx1[cancelListenersSymbol]).toHaveLength(3); // two sub-ctx and one onCancel
            expect(ctx2[cancelListenersSymbol]).toHaveLength(1); // one onCancel
            expect(ctx3[cancelListenersSymbol]).toHaveLength(1); // one onCancel

            switch (mode) {
                case 'cancel1': {
                    if (cancel1) cancel1(testCancel);
                    expect(cnt1).toBe(1);
                    expect(cnt2).toBe(1);
                    expect(cnt3).toBe(1);
                    expect(ctx1[cancelListenersSymbol]).toBeUndefined();
                    expect(ctx1.err).toBe(testCancel);
                    expect(ctx2[cancelListenersSymbol]).toBeUndefined();
                    expect(ctx2.err).toBe(testCancel);
                    expect(ctx3[cancelListenersSymbol]).toBeUndefined();
                    expect(ctx3.err).toBe(testCancel);
                }
                    break;
                case 'cancel2': {
                    if (cancel2) cancel2(testCancel);
                    expect(cnt1).toBe(0);
                    expect(cnt2).toBe(1);
                    expect(cnt3).toBe(0);

                    expect(ctx1[cancelListenersSymbol]).toHaveLength(3);
                    expect(ctx1.err).toBeUndefined();
                    expect(ctx2.hasOwnProperty(cancelListenersSymbol)).toBeFalsy();
                    expect(ctx2.err).toBe(testCancel);
                    expect(ctx3[cancelListenersSymbol]).toHaveLength(1);
                    expect(ctx3.err).toBeUndefined();
                }
                    break;
                case 'cancel3': {
                    if (cancel3) cancel3(testCancel);
                    expect(cnt1).toBe(0);
                    expect(cnt2).toBe(0);
                    expect(cnt3).toBe(0); // no cancel3;
                    expect(ctx1[cancelListenersSymbol]).toHaveLength(3); // two sub-ctx and one onCancel
                    expect(ctx2[cancelListenersSymbol]).toHaveLength(1); // one onCancel
                    expect(ctx3[cancelListenersSymbol]).toHaveLength(1); // one onCancel
                }
                    break;
                case 'unsub': {
                    unsub1();
                    unsub2();
                    unsub3();
                    unsub1(); // second time call won't affect
                    unsub2(); // second time call won't affect
                    unsub3(); // second time call won't affect
                    expect(ctx1[cancelListenersSymbol]).toHaveLength(2); // two listening child ctx
                    expect(ctx2[cancelListenersSymbol]).toHaveLength(0);
                    expect(ctx3[cancelListenersSymbol]).toHaveLength(0);
                }
                    break;
                case 'dispose': {
                    expect(ctx1[cancelListenersSymbol]).toHaveLength(3); // one onCancel and two listening child ctx
                    if (dispose2) dispose2(); // dispose ctx2
                    expect(ctx1[cancelListenersSymbol]).toHaveLength(2); // one onCancel and one listening child ctx
                    if (dispose2) dispose2(); // // second time call won't affect
                    expect(ctx1[cancelListenersSymbol]).toHaveLength(2); // one onCancel and one listening child ctx
                    if (dispose3) dispose3(); // dispose ctx3
                    expect(ctx1[cancelListenersSymbol]).toHaveLength(1); // one onCancel
                    unsub1();
                    expect(ctx1[cancelListenersSymbol]).toHaveLength(0); // nothing
                    unsub1(); // second time call won't affect
                }
                    break;
                case 'timeout': {
                    const {ctx: _ctx4, dispose: dispose4} = ctx1.createChild({timeout: 2_000});
                    jest.advanceTimersByTime(10_000);
                    dispose4!();
                }
                    break;
                case 'timeout dispose': {
                    const {ctx: _ctx4, dispose: dispose4} = ctx1.createChild({timeout: 2_000});
                    dispose4!();
                }
                    break;
            }
        });

    for (const mode of [
        'dispose after timeout',
        'dispose before timeout',
    ])
        it(`dispose with timeout; mode: ${mode}`, () => {
            jest.useFakeTimers();
            const {ctx: ctx1} = Context.createNew({cancel: true});
            // dispose2 whould combine cancel timer and unsubscribe from ctx1.onCancel
            const {ctx: ctx2, dispose: dispose2} = ctx1.createChild({timeout: 2_000});
            let cnt = 0;
            ctx2.onCancel!((cause) => {
                cnt++;
                expect(Context.isTimeout(cause)).toBeTruthy();
            })
            switch (mode) {
                case 'dispose after timeout': {
                    jest.advanceTimersByTime(10_000);
                    dispose2!();
                    dispose2!(); // second time call won't affect
                    expect(cnt).toBe(1);
                }
                    break;
                case 'dispose before timeout': {
                    dispose2!();
                    jest.advanceTimersByTime(10_000);
                    dispose2!(); // second time call won't affect
                    expect(cnt).toBe(0);
                }
                    break;
            }
        });

    for (const mode of [
        'general',
        'dispose',
    ])
        it(`timeout; mode: ${mode}`, () => {
            jest.useFakeTimers();
            const {ctx, cancel, dispose, done} = Context.createNew({
                timeout: 2_000,
            });
            expect(cancel).toBeUndefined();
            expect(dispose).toBeDefined();
            expect(done).toBeUndefined();
            expect(ctx.onCancel).toBeDefined();
            switch (mode) {
                case 'general': {
                    let cnt = 0;
                    ctx.onCancel!((cause) => {
                        cnt++;
                        expect(Context.isTimeout(cause)).toBeTruthy();
                        expect(Context.isDone(cause)).toBeFalsy();
                    });
                    expect(cnt).toBe(0);
                    jest.advanceTimersByTime(1_000);
                    expect(cnt).toBe(0);
                    jest.advanceTimersByTime(1_000);
                    expect(cnt).toBe(1);
                    expect(Context.isTimeout(ctx.err!)).toBeTruthy();
                    jest.advanceTimersByTime(1_000);
                    expect(cnt).toBe(1);
                }
                    break;
                case 'dispose': {
                    dispose!();
                    dispose!(); // second time call won't affect
                }
                    break;
            }
        });

    it('done', () => {
        const {ctx, done} = Context.createNew({
            done: true,
        });
        expect(ctx.onCancel).toBeDefined();
        let cnt = 0;
        ctx.onCancel!((cause) => {
            cnt++;
            expect(Context.isDone(cause)).toBeTruthy();
            expect(Context.isTimeout(cause)).toBeFalsy();
        });
        expect(cnt).toBe(0);
        done!();
        expect(cnt).toBe(1);
        expect(Context.isDone(ctx.err!)).toBeTruthy();
    });

    it('values', () => {
        const Symbol1 = Symbol('a');
        const Symbol2 = Symbol('b');

        const {ctx: ctx1} = Context.createNew();
        ctx1[Symbol1] = 'aaa';

        const {ctx: ctx2} = ctx1.createChild();
        ctx2[Symbol2] = 'bbb';

        const {ctx: ctx3} = ctx2.createChild();
        expect(ctx2[Symbol1]).toBe('aaa');
        expect(ctx3[Symbol2]).toBe('bbb');
    });

    it('break cancel-chain', () => {
        const Symbol1 = Symbol('a');

        const {ctx: ctx1, cancel: cancel1} = Context.createNew({cancel: true});
        ctx1[Symbol1] = 'aaa';

        const {ctx: ctx2, cancel: cancel2, dispose, done} = ctx1.createChild({cancel: false});

        expect(ctx1.onCancel).toBeDefined();
        expect(cancel1).toBeDefined();

        expect(ctx2.onCancel).toBeUndefined();
        expect(cancel2).toBeUndefined();
        expect(dispose).toBeUndefined();
        expect(done).toBeUndefined();

        expect(ctx2[Symbol1]).toBe('aaa');
    });

    it('keep using old context if possible', () => {
        const {ctx} = Context.createNew();
        expect(ctx.createChild().ctx).toBe(ctx);

        expect(ctx.createChild({}).ctx).toBe(ctx);
        expect(ctx.createChild({timeout: -1}).ctx).toBe(ctx);
        expect(ctx.createChild({timeout: undefined}).ctx).toBe(ctx);

        expect(ctx.createChild({cancel: true}).ctx).not.toBe(ctx);
        expect(ctx.createChild({cancel: false}).ctx).not.toBe(ctx);
        expect(ctx.createChild({timeout: 12}).ctx).not.toBe(ctx);
        expect(ctx.createChild({done: true}).ctx).not.toBe(ctx);
    });

    for (const scenario of ['ok', 'failed', 'cancel'])
        it(`'cancellablePromise: scenario: ${scenario}`, async () => {
            let promiseResolve: (value: unknown) => void, promiseReject: (reason?: any) => void;
            const promise = new Promise((resolve, reject) => {
                promiseResolve = resolve;
                promiseReject = reject;
            })
            const {ctx} = Context.createNew();
            expect(ctx.cancelRace(promise)).toBe(promise);

            const {ctx: ctx2, cancel} = ctx.createChild({
                cancel: true,
            });

            const promise2 = ctx2.cancelRace(promise);
            expect(promise2).not.toBe(promise);

            switch (scenario) {
                case 'ok': {
                    promiseResolve!(12);
                    expect(await promise2).toBe(12);
                }
                    break;
                case 'failed': {
                    promiseReject!(new Error('test'));
                    await expect(promise2).rejects.toThrow('test');
                }
                    break;
                case 'cancel': {
                    cancel!();
                    await expect(promise2).rejects.toThrow('Unknown');
                }
                    break;
            }
        });

    it('make 100% coverage', () => {
        {
            const {ctx} = Context.createNew({id: 'test'});
            expect(ctx.id).toBe('test'); // context.id might be set for new ctx
        }
        {
            const {ctx, cancel} = Context.createNew({cancel: true});
            cancel!(); // cancel without case
            let cnt = 0;
            ctx.onCancel!((cause) => { // subscribe after cancel
                cnt++;
                expect(cause.message).toBe('Unknown'); // default cause
            });
        }
        {
            const {cancel} = Context.createNew({cancel: true});
            cancel!();
            cancel!(); // already cancelled
        }
    });
})
