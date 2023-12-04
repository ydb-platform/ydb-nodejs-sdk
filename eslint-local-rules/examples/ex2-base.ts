/* es-lint-enable context */

const f = () => {
    console.info(100);
};

const t = () => {
    const ctx = {};

    // await ctx.do.do(() => f());
    f();
};
