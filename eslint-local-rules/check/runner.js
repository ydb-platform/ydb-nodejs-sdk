const path = require('path'); // eslint-disable-line unicorn/prefer-module
const {
    writeFile,
    unlink,
} = require('fs').promises; // eslint-disable-line unicorn/prefer-module
const {variantsGenerator} = require('./generate'); // eslint-disable-line unicorn/prefer-module
const { ESLint } = require('eslint'); // eslint-disable-line unicorn/prefer-module

const eslint = new ESLint({
    fix: true,
    useEslintrc: true,
});

// eslint-disable-next-line unicorn/prefer-top-level-await
(async () => {

    // eslint-disable-next-line unicorn/prefer-module
    const fromFilename = path.resolve(__dirname, 'tmp/from.ts');
    // eslint-disable-next-line unicorn/prefer-module
    const toFilename = path.resolve(__dirname, 'tmp/to.ts');

    // eslint-disable-next-line no-unreachable-loop
    for (const v of variantsGenerator) {

        const fromSource = `/* eslint local-rules/context: "error" */\n${v.from.code}`;
        const toSource = `/* eslint local-rules/force-formatting: "error" */\n${v.to.code}`;

        // eslint-disable-next-line no-await-in-loop
        await Promise.all([
            // eslint-disable-next-line unicorn/prefer-module
            writeFile(fromFilename, fromSource),
            // eslint-disable-next-line unicorn/prefer-module
            writeFile(toFilename, toSource),
        ]);

        // eslint-disable-next-line no-await-in-loop
        const [[fromOut], [toOut]] = await Promise.all([
            eslint.lintFiles(fromFilename), // eslint-disable-line unicorn/prefer-module
            eslint.lintFiles(toFilename), // eslint-disable-line unicorn/prefer-module
        ]);

        const from = (fromOut.output || fromOut.source).replaceAll(/\/\* eslint local.* \*\/\n/g, '');
        const to = (toOut.output || toOut.source).replaceAll(/\/\* eslint local.* \*\/\n/g, '');

        console.info(200, { from, to });
        break;
    }
})();
