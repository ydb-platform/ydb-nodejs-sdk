const path = require('path');
const { ESLint } = require('eslint');

const testCode = `
  const name = 'eslint'
  if(true) {
    console.log("constant condition warning")
  };
`;

(async function main() {
    // 1. Create an instance
    const eslint = new ESLint({
        fix: true,
        useEslintrc: true,
        // overrideConfig: {
        //     extends: ["eslint:recommended"],
        //     parserOptions: {
        //         sourceType: "module",
        //         ecmaVersion: "latest",
        //     },
        //     env: {
        //         es2022: true,
        //         node: true,
        //     },
        // },
    });

    // 2. Lint text.
    // const results = await eslint.lintText(testCode, { filePathd: path.join(process.cwd(), 'eslint-local-rules/examples/temp.ts') });
    const results = await eslint.lintFiles('C:\\work\\ydb-nodejs-sdk-331\\eslint-local-rules\\examples\\ex20.ts');
    // await eslint.lintFiles('C:\\work\\ydb-nodejs-sdk-331\\eslint-local-rules\\examples\\ex20.ts');

    console.info(100, results)

    // 3. Format the results.
    const formatter = await eslint.loadFormatter("stylish");
    const resultText = formatter.format(results);

    // 4. Output it.
    console.log(200, resultText);
    console.log(300, ESLint.getErrorResults(results));
})().catch((error) => {
    process.exitCode = 1;
    console.error(error);
});
