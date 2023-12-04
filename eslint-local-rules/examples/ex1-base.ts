const t = (a: number, b: number) => a + b;

class A {
    private readonly _a; // no new on fields

    constructor() {
        this._a = new A(); // ctx.do.doSync
        setTimeout(t, 0); // ctx.do.doHandleError
    }

    // a comment
    f() { // no need for ctx.do
        console.info(1000, '123'); // nodejs api call
    }

    // a comment
    t() { // missing ctx.do
        this.f();

        return t(1, 2); // await ctx.do.do
    }
}

const q = () => {};
