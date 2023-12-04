/* eslint local-rules/context3: "warn" */
import fs from 'fs';

const path = await ctx.do(() => require('path'));

/*
test comments
 */
const f = () => {
    await ctx.do(() => console.info(100));
};

// line 1
// line 2
const t = () => {
    const ctx = {};

    // await ctx.do.do(() => f());
    await ctx.do(() => f());
};
