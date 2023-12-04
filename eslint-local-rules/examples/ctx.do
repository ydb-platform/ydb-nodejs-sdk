
await? ctx.do?<doSync, doHandleError>(() => f());?

await ctx.do(() => f());

ctx.do(() => f());


