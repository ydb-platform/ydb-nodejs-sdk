// @ts-ignore
// eslint-disable-next-line unicorn/prefer-module
module.exports = (opts) => { // code renderer
    try {
        // console.info(1000, (opts.method || opts.func).ctx, opts)
        const ctx = `${opts.call.ctx
            ? 'const ctx = '
            : ''} ContextWithLogger.${(opts.static || opts.func)
            ? 'get'
            // eslint-disable-next-line max-len
            : 'getSafe'}('ydb-sdk:...eslint-local-rules.check.tmp.${(opts.method || opts.func).trace}'${(opts.static || opts.func) ? '' : ', this'})\n`;
        const imprt = 'import { ContextWithLogger } from \'../../../src/context-with-logger\';\n'; // TODO: Add logic later

        return opts.class
            // class template
            ? `
// opts.id: ${opts.id}
${imprt}
class A {
    ${opts.method.before}
        ${ctx && opts.method.noParenthesis ? '{' : ''}
        ${ctx}
        ${opts.call.text}
        ${ctx && opts.method.noParenthesis ? '}' : ''}
    ${opts.method.after}
}`
            // function template
            : `
// opts.id: ${opts.id}
${imprt}
${opts.func.before}
    ${ctx && opts.func.noParenthesis ? '{' : ''}
    ${ctx}
    ${opts.call.text}
    ${ctx && opts.func.noParenthesis ? '}' : ''}
${opts.func.after}`;
    } catch (error) {
        console.info(`v: ${JSON.stringify(opts)}`);
        // @ts-ignore
        error.message = `Fialed on render (variantID: ${opts.variantID}): ${error.message}`;
        throw error;
    }
};
