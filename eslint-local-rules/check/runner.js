const path = require('path'); // eslint-disable-line unicorn/prefer-module
const {
    writeFile,
    unlink,
} = require('fs').promises; // eslint-disable-line unicorn/prefer-module
const {variantsGenerator} = require('./generate'); // eslint-disable-line unicorn/prefer-module
const {ESLint} = require('eslint'); // eslint-disable-line unicorn/prefer-module

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
    // eslint-disable-next-line unicorn/prefer-module
    const expectedFilename = path.resolve(__dirname, 'tmp/expected.ts');

    // eslint-disable-next-line no-unreachable-loop
    for (const v of variantsGenerator) {

        const fromSource = `/* eslint local-rules/context: "error" */\n${v.from.code}`;
        const expectedSource = v.to.code;
        // const toSource = `/* eslint local-rules/force-formatting: "error" */\n${v.expected.code}`;

        // eslint-disable-next-line no-await-in-loop
        await Promise.all([
            // eslint-disable-next-line unicorn/prefer-module
            writeFile(fromFilename, fromSource),
            // eslint-disable-next-line unicorn/prefer-module
            unlink(toFilename)
                .catch(() => {}), // ignore 'no such file'
            // eslint-disable-next-line unicorn/prefer-module
            writeFile(expectedFilename, expectedSource),
        ]);

        // eslint-disable-next-line no-await-in-loop
        const [[fromOut], [expectedOut]] = await Promise.all([
            eslint.lintFiles(fromFilename), // eslint-disable-line unicorn/prefer-module
            eslint.lintFiles(expectedFilename), // eslint-disable-line unicorn/prefer-module
        ]);

        const to = (fromOut.output || fromOut.source).replaceAll(/\/\* eslint local.* \*\/\n/g, '');
        const expected = (expectedOut.output || expectedOut.source).replaceAll(/\/\* eslint local.* \*\/\n/g, '');

        // eslint-disable-next-line no-await-in-loop
        await writeFile(toFilename, `/** Expected:\n\n${expected}\n*/\n${to}`); // eslint-disable-line unicorn/prefer-module

        if (to !== expected) {
            console.info(`Failed on version id: ${v.id} (See 'tmp/to.ts' for details)`);
            break;
        }

        break;
    }
})();
