module.exports = (code) => {
    code = code.replaceAll(/\/\* eslint .* \*\/\n\n?/g, ''); // remove eslint directives
    // code = code.replaceAll(/((\w*):name)\s*:\s*(async:async)?\s*\(/g, (v) => {
    //     return '$async $name(';
    // });
    return code;
}
