module.exports = {
    trailingComma: 'all',
    tabWidth: 4,
    printWidth: 100,
    semi: true,
    singleQuote: true,
    bracketSpacing: false,
    overrides: [
        {
            files: ['*.yml', '*.yaml'],
            options: {
                tabWidth: 2,
            },
        },
    ],
};
