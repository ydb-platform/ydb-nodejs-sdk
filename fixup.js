const fs = require('fs');
const package = require('./package.json');

['esm', 'cjs'].forEach((target) => {
    fs.writeFileSync(
        `build/${target}/package.json`,
        `{
    "version": "${package.version}"
}
`,
    );
});
