// eslint-disable-next-line unicorn/prefer-module
const {FILTER_VARIANT_ID} = require('./consts');

/**
 * go through the code variants and the expected results of the eslint rule application, in order to run
 * it through eslint --fix and check that the expected code is obtained as a result
 */
// eslint-disable-next-line @typescript-eslint/no-shadow
function* variantsGenerator(_config, codeRenderer, id, _opts) {
    const opts = {..._opts};

    if (_config.length > 0) {
        // the first value of config level is the key in which the values
        // from the second parameter of the config record will be enumerated in the context
        const level = _config[0];
        const configRest = _config.slice(1);
        // the second value of config level is an array of possible values, or a function returning
        // an array or a generator function
        let valuesList = level[1];
        const verionKey = level[0];
        let cnt = 0;
        // eslint-disable-next-line @typescript-eslint/no-shadow
        let config = configRest;

        if (typeof valuesList === 'function') valuesList = valuesList(opts);
        for (const value of valuesList) {
            opts[verionKey] = value;
            // A configuration tree can have conditional branching if you specify a function that
            // returns an array as the tail of the config depending on the context
            if (typeof level[2] === 'function') config = [...level[2](opts), ...configRest];
            yield* variantsGenerator(config, codeRenderer, (id || '') + String.fromCodePoint(97 + cnt++), opts);
        }
    } else {
        if (FILTER_VARIANT_ID && FILTER_VARIANT_ID !== id) return;

        const fromOpts = {};
        const toOpts = {};

        for (const key in opts) { // different value for from and to
            if (Array.isArray(opts[key])) {
                [fromOpts[key], toOpts[key]] = opts[key];
            } else { // same value for from and to
                fromOpts[key] = opts[key];
                toOpts[key] = opts[key];
            }
        }
        fromOpts.type = 'from';
        fromOpts.id = id;
        toOpts.type = 'to';
        toOpts.id = id;
        yield {
            id,
            from: {
                code: codeRenderer(fromOpts),
                opts: fromOpts,
            },
            to: {
                code: codeRenderer(toOpts),
                opts: toOpts,
            },
            fromOpts,
            toOpts,
        };
    }
}

// eslint-disable-next-line unicorn/prefer-module
module.exports = variantsGenerator(require('./config'), require('./code-renderer'));
