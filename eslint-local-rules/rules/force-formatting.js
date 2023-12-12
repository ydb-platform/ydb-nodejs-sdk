module.exports = {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'force --fix format code without check',
            recommended: true,
            url: null,
        },
        fixable: true,
        schema: [],
    },
    create: (context) => {
        let n = 0;
        return {
            'program:exit'(node) {
                if (n++ === 1) { // only first time
                    return {
                        message: 'Add space at the beginning',
                        fix: (fixer) => {
                            fixer.insertTextBefore(node, 'x');
                        },
                    };
                }
            }
        }
    },
};
