/* eslint local-rules/context: "error" */

const f = () => {
    await ctx.do(() => console.info(100));
};

const t = () => {
    const ctx = {};

    // await ctx.do.do(() => f());
    await ctx.do(() => f());
};
