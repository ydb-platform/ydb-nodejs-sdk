import fs from 'fs';

const path = await ctx.do(() => require('path'));

const f = () => {
    await ctx.do(() => console.info(100));
};

const t = () => {
    const ctx = {};

    // await ctx.do.do(() => f());
    await ctx.do(() => f());
};
