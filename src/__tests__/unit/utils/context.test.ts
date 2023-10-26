import {Context, NOT_A_CONTEXT, setContextNewIdGenerator} from "../../../utils/context";

describe('utils.context', () => {
    it('general', async () => {
       const ctx1 = new Context();
       expect(ctx1.id).toBeUndefined();
       expect(ctx1.toString()).toBe('');

       let n = 0;
       setContextNewIdGenerator(() => n++);
       setContextNewIdGenerator(() => ''); // 2nd assignment should be ignored
       const ctx2 = new Context();
       expect(ctx2.id).toBe(0);
       const ctx3 = new Context();
       expect(ctx3.id).toBe(1);

       ctx3.do(() => {
           const ctx = ctx3.findContextByClass<Context>(Context);
           expect(ctx3).toBe(ctx);
       });

       const ctx4 = new Context(ctx3);
       expect(ctx4.id).toBe(1);
       expect(ctx4.toString()).toBe('1: ');
    });

    it('context-chain look up', async () => {
        class A extends Context {}
        class B extends Context {}
        class C extends Context {}

        const a = new A();

        const b = new B(a);

        expect(b.findContextByClass(A)).toBe(a);
        expect(b.findContextByClass(B)).toBe(b);
        expect(b.findContextByClass(C)).toBe(NOT_A_CONTEXT);
    });

    it('done is invoked at the end of do()', async () => {
        class A extends Context {
            done = jest.fn();
        }
        const a = new A();
        expect(await a.do(() => 123)).toBe(123);
        expect(a.done.mock.calls).toEqual([[undefined]]);
        const error = new Error('test');
        await expect(a.do(() => {
            throw error})).rejects.toThrow(error);
        expect(a.done.mock.calls).toEqual([[undefined], [error]]);

        a.done.mockReset();
        class B extends Context {
            // without done
        }
        const b = new B(a);
        expect(await b.do(() => 123)).toBe(123);
        expect(a.done.mock.calls).toEqual([[undefined]]);
        expect(b.do(() => {
            throw error})).rejects.toThrow(error);
        expect(a.done.mock.calls).toEqual([[undefined], [error]]);
    });
});
