import {Context} from "../../context/Context";
import {ensureContext} from "../../context/EnsureContext";

describe('ensureContext', () => {
    it('positional args', () => {
        class Test {
            // @ts-ignore
            noArgs(): void;
            noArgs(ctx: Context): void;
            @ensureContext(true)
            noArgs(ctx: Context): void {
                expect(ctx instanceof Context).toBeTruthy();
            }

            // @ts-ignore
            posArgs(n: number, s: string): void;
            posArgs(ctx: Context, n: number, s: string): void;
            @ensureContext(true)
            posArgs(ctx: Context, n: number, s: string) {
                expect(ctx instanceof Context).toBeTruthy();
                expect(n).toBe(12);
                expect(s).toBe('test');
            }

            // @ts-ignore
            static staticNoArgs(): void;
            static staticNoArgs(ctx: Context): void;

            @ensureContext(true)
            static staticNoArgs(ctx: Context) {
                expect(ctx instanceof Context).toBeTruthy();
            }
        }

        const test = new Test();

        test.noArgs();
        test.noArgs(Context.createNew().ctx);

        test.posArgs(12, 'test');
        test.posArgs(Context.createNew().ctx, 12, 'test');

        Test.staticNoArgs();
    });

    it('named args', () => {
        class Test {
            // noArgs(): void;
            // noArgs(opts: {
            //     ctx?: Context,
            // }): void;
            @ensureContext()
            noArgs(opts?: {
                ctx?: Context,
            }): void {
                const ctx = opts!.ctx!;
                expect(ctx instanceof Context).toBeTruthy();
            }

            @ensureContext(false) // should throw error cause fire arg is not obj
            mismatchTypeOfArgs(n: number, s: string) {
                expect(n).toBe(12);
                expect(s).toBe('test');
            }
        }

        const test = new Test();

        test.noArgs();
        test.noArgs({});
        test.noArgs({
            ctx: Context.createNew().ctx,
        });

        expect(() => test.mismatchTypeOfArgs(12, 'test')).rejects
            .toThrow('An object with options or undefined is expected as the first argument');
    });
});
