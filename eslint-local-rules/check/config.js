// eslint-disable-next-line unicorn/prefer-module
module.exports = [ // config
    ['async', ['async ', ''],
        (opts) => opts.async
            ? [ // async
                ['call', [
                    [{text: 'await V()'}, {text: 'await ctx.do(() => V())', ctx: true }],
                    [{text: 'V()'}, {text: 'V()'}],
                    [{text: 'await ctx.do(() => V())'}, {text: 'await ctx.do(() => V())', ctx: true}],
                    [{text: 'await ctx.doSync(() => V())'}, {text: 'await ctx.do(() => V())', ctx: true}],
                ]]]
            : [ // sync
                ['call', [
                    [{text: 'V()'}, {text: 'V()'}],
                    [{text: 'ctx.do(() => V())'}, {text: 'V()'}],
                    [{text: 'ctx.doSync(() => V())'}, {text: 'V()'}],
                ]],
            ],
    ],
    ['class', [true, false],
        (opts) => opts.class
            ? [ // class
                ['accessibility', ['', 'public ', 'protected ', 'private ']],
                ['static', ['', 'static ']],
                ['method', (opts) => [
                    {
                        before: `${opts.accessibility}${opts.static}${opts.async}F() {`,
                        after: '}',
                        trace: 'A.F',
                    },
                    {
                        before: `${opts.accessibility}${opts.static}F = ${opts.async}() => {`,
                        after: '}',
                        trace: 'A.F',
                    },
                    {
                        before: `${opts.accessibility}${opts.static}F = ${opts.async}() => `,
                        after: '',
                        trace: 'A.F',
                        noParenthesis: true,
                    },
                ]],
            ]
            : [ // function
                ['func', [
                    {
                        before: `${opts.async}function Q() {`,
                        after: '};',
                        trace: 'Q',
                    },
                    {
                        before: `const Q = ${opts.async}() => {`,
                        after: '};',
                        trace: 'Q',
                    },
                    {
                        before: `const Q = ${opts.async}() => `,
                        after: ';',
                        trace: 'Q',
                        noParenthesis: true,
                    },
                ]],
            ]],
];
