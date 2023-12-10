// leave only variants with the specified variantID in the result (regexp)
const FILTER_VARIANTID = null;
// const FILTER_VARIANTID = /^b.*!/;

/**
 * go through the code variants and the expected results of the eslint rule application, in order to run
 * it through eslint --fix and check that the expected code is obtained as a result
 */
const variantsGenerator = (function* buildVariants(config, codeRenderer, variantID, renderOptions) {
    if (config.length) {
        // the first value of config level is the key in which the values
        // from the second parameter of the config record will be enumerated in the context
        const level = config[0];
        // the second value of config level is an array of possible values, or a function returning
        // an array or a generator function
        let valuesList = level[1];
        if (typeof valuesList === 'function') valuesList = valuesList(renderOptions);
        renderOptions = Object.assign({}, renderOptions);
        const verionKey = level[0];
        config = config.slice(1);
        let cnt = 0;
        for (let value of valuesList) {
            renderOptions[verionKey] = value;
            // A configuration tree can have conditional branching if you specify a function that
            // returns an array as the tail of the config depending on the context
            if (typeof level[2] === 'function') config = level[2](renderOptions);
            yield* buildVariants(config, codeRenderer, (variantID || '') + String.fromCharCode(97 + cnt++), renderOptions);
        }
    } else {
        if (FILTER_VARIANTID && !FILTER_VARIANTID.test(variantID)) return;
        const fromOptions = {};
        const toOptions = {};
        for (let key in renderOptions) { // different value for from and to
            if (Array.isArray(renderOptions[key])) {
                fromOptions[key] = renderOptions[key][0];
                toOptions[key] = renderOptions[key][1];
            } else { // same value for from and to
                fromOptions[key] = renderOptions[key];
                toOptions[key] = renderOptions[key];
            }
        }
        fromOptions.type = 'from';
        fromOptions.variantID = variantID;
        toOptions.type = 'to';
        toOptions.variantID = variantID;
        yield {
            variantID,
            from: codeRenderer(fromOptions),
            to: codeRenderer(toOptions),
            fromOptions,
            toOptions,
        }
    }
})([ // config
        ['call', [
            // ['V();', 'ctx.doSync(() => V());'],
            ['await V();', 'await ctx.do(() => V());'],
            // ['ctx.doSync(() => V());', 'ctx.doSync(() => V());'],
            // ['await ctx.do(() => V());', 'await ctx.do(() => V());'],
            // ['await ctx.doAsync(() => V());', 'await ctx.do(() => V());'], // wrong to right
        ]],
        ['class', [true, false], (v) => v.class
            ? [ // class
                ['accessibility', ['', 'public ', 'protected ', 'private ']],
                ['static', ['', 'static ']],
                ['wrapCode', (opts) =>
                    [
                        {
                            before: `${opts.accessibility}${opts.static}F() {`,
                            after: `}`,
                        },
                        {
                            before: `${opts.accessibility}${opts.static}F = () => {`,
                            after: `}`,
                        },
                        {
                            before: `${opts.accessibility}${opts.static}F = () => `,
                            after: ``,
                        },
                    ].map(t => ({
                        before: `class A { ${t.before}`,
                        after: `${t.after} }`,
                    }))],
            ]
            : [ // function
                ['wrapCode', [
                    {
                        before: 'function() {',
                        after: '};',
                    },
                    {
                        before: '() => {',
                        after: '};',
                    },
                    {
                        before: '() => ',
                        after: ';',
                    },
                ]],
            ]],
    ],
    (opts) => { // code renderer
        try {
            return `${opts.wrapCode.before} ${opts.call} ${opts.wrapCode.after}`
        } catch (err) {
            console.info(`v: ${JSON.stringify(opts)}`);
            err.message = `Fialed on render (variantID: ${opts.variantID}): ${err.message}`
            throw err;
        }
    });

for (let v of variantsGenerator) {
    console.info('f', `${v.fromOptions.variantID}`, v.from)
    console.info('t', `${v.toOptions.variantID}`, v.to, '\n')
}
