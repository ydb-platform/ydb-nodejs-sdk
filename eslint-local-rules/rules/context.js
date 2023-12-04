const path = require('path');
const debug = require('debug')('rule:context');

const STATE_CLASS = 'class';
const STATE_FUNC = 'func';
const STATE_METHOD = 'method';

// TODO: Decorators
// TODO: Fix doHandleError to match setTimeout types\
// TODO: Add this.logger -> ctx.logger
// TODO: Cpnsoder not to context methods without ctx
// TODO: Sync methods to async for tracing`` - later
// TODO: Ignore object from ignore classes - later

const SRC_PATH = '/src';
const CONTEXT_CLASS = 'ContextWithLogger';
const CONTEXT_CLASS_PATH = '/context-with-logger';
const TRACKING_PREFIX = 'ydb-sdk:';
const TRACKING_DELIMITER = '.';

let itCount = 0;

/**
 * List of global classes and global instances and libs that not suppose toi be wrapped by context.
 */
const IGNORE_GLOBALS = [
    // globals
    'ctx', 'Promise', 'console', 'Date', /*'F',*/

].reduce((o, v) => (o[v] = true, o), Object.create(null));

const IGNORE_NPMS = [
    // NodeJS packages
    'fs', 'path',
].reduce((o, v) => (o[v] = true, o), Object.create(null));

// eslint-disable-next-line unicorn/prefer-module
module.exports = {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'apply ContextWithLogger rules',
            recommended: true,
            url: null,
        },
        fixable: true,
        schema: [], // TODO: add context name, traking-prefix
    },
    create: (context) => {
        debug('create(context) {} [iteration %d]', itCount++);

        /**
         * Nesting levels
         */
        const stack = [];

        let state = {
            type: 'root', // class, ctxDo, call
            ignore: IGNORE_GLOBALS,
            methodName: null,
        };

        let rootFuncState;

        const filenameParsed = path.parse(context.filename);
        const folderPrefix = path.relative(path.join(process.cwd(), SRC_PATH), filenameParsed.dir).replace(/[\\/]/g, '.');

        const pushToStack = (type, name, opts) => {
            stack.push(state);
            state = {
                ...opts,
                type,
                methodName: state.methodName === null
                    ? `${TRACKING_PREFIX}${folderPrefix.length > 0 ? `${folderPrefix}.` : ''}${name}`
                    : `${state.methodName}${TRACKING_DELIMITER}${name}`,
                prevIgnore: state.ignore || state.prevIgnore,
                // hasCtx: false, // true - at least one line with ctx.do...
                // ctxNode: undefined, // line with CONTEXT_CLASS.get or CONTEXT_CLASS.safeGet
            };
            state.async = false; // TODO: remove later
            if ('async' in opts) state.async = false; // TODO: Make it back before work on open ... (tracing)
            if ('exported' in opts) state.async = false; // TODO: Make it back before work on open ... (tracing)
            if ((!rootFuncState && ~['func', 'method'].findIndex(v => v === state.type)) || opts.rootFunc) {
                rootFuncState = state;
                state.isRootMethod = true;
            }
        };

        const popFromStack = () => {
            if (state.type === 'root') throw new Error('Already in the root');
            if (rootFuncState === state) rootFuncState = undefined;
            if (state.hasCtx) anyContextInFile = true;
            state = stack.pop();
        }

        const isDecorator = (node) => context.getCommentsBefore(node).indexOf('@decorator');

        let anonymouseIndex = 0;

        let anyContextInFile = false;

        let importContextNode; // :ImportDeclaration

        let lastImportDeclarationNode; // :ImportDeclaration

        let programNode;

        return {
            'Program'(node) {
                debug('Program');
                programNode = node;
            },
            'Program:exit'(node) {
                debug('Program:exit');
                fixImportContext(context, node);
            },
            'ImportDeclaration'(node) {
                debug('ImportDeclaration');
                lastImportDeclarationNode = node;

                if (node.source.value.endsWith(CONTEXT_CLASS_PATH)) {
                    importContextNode = node;
                    return;
                }

                // fullfill ignore from import // TODO: Check import spec for all pssible forms
                if (!IGNORE_NPMS[node.source.value]) return;
                node.specifiers.forEach(
                    importSpecifier => {
                        (state.ignore || (state.ignore = Object.create(state.prevIgnore)))[importSpecifier.local.name] = true;
                    })
            },
            'CallExpression'(node) {
                debug('CallExpression');

                // fullfill ignore from require()
                if (node.callee.name === 'require') {
                    if (!IGNORE_NPS[node.arguments[0].value]) return;
                    if (node.parent.type !== 'VariableDeclarator') return;
                    listVariableNames(node.parent.id);
                    return;
                }

                // skip decorator calls
                if (node.parent.type === 'Decorator') return;

                // context initialization
                if (node.callee.object?.name === CONTEXT_CLASS && ~['get', 'getSafe'].findIndex(v => v === node.callee.property.name)) {
                    let line = node;
                    if (line.parent.type === 'VariableDeclarator') line = line.parent;
                    if (line.parent.type === 'VariableDeclaration') line = line.parent;
                    rootFuncState.ctxNode = line;
                    return;
                }

                // skip ctx.do...
                // if (node.callee.name === 'ctx' || node.callee.object?.name === 'ctx') return;

                if (~['setTimeout', 'setInterval'].findIndex(v => v === node.callee.name)) {
                    // wrap setTimeout, setInterval
                    // fixSetTimeoutAndSetInterval(node); // TODO: Fix
                } else {
                    // wrap other calls
                    fixCtxDo(node);
                }
            },

            // classes
            'ClassDeclaration'(node) {
                debug('ClassDeclaration');
                pushToStack(STATE_CLASS, node.id.name, {
                    exported: 'exportKind' in node.parent,
                });
            },
            'ClassDeclaration:exit'(node) {
                debug('ClassDeclaration:exit');
                popFromStack();
            },

            // methods
            'MethodDefinition'(node) {
                debug('MethodDefinition');
                pushToStack(STATE_METHOD, node.key.name, {
                    async: node.async,
                    exported: state.exported && node.accessabilty !== 'private',
                });
            },
            'MethodDefinition:exit'(node) {
                debug('MethodDefinition:exit');
                fixGetContext(node);
                popFromStack();
            },

            // classes
            'ArrowFunctionExpression'(node) {
                debug('ArrowFunctionExpression');
                pushToStack(STATE_FUNC,
                    node.parent.type === 'VariableDeclarator'
                        ? node.parent.id.name
                        : `${filenameParsed.name}_${(++anonymouseIndex).toString().padStart(3, '0')}`,
                    {
                        exported: 'exportKind' in node.parent?.parent?.parent,
                    });

            },
            'ArrowFunctionExpression:exit'(node) {
                debug('ArrowFunctionExpression:exit');
                fixGetContext(node);
                popFromStack(   );
            },
            'FunctionExpression'(node) {
                debug('FunctionExpression');
                pushToStack(STATE_FUNC,
                    node.id
                        ? node.id.name
                        : `${filenameParsed.name}_${(++anonymouseIndex).toString().padStart(3, '0')}`,
                    {
                        exported: 'exportKind' in node.parent,
                    });
            },
            'FunctionExpression:exit'(node) {
                debug('FunctionExpression:exit');
                fixGetContext(node);
                popFromStack();
            },

            'ThisExpression'(node) {
                // this.logger -> ctx.logger
                if (node.parent.type === 'MemberExpression' && node.parent.property.name === 'logger') {
                    rootFuncState.hasCtx = true;
                    if (debug.enabled) {
                        console.info(400, 'fix', context.sourceCode.getText(node.parent));
                        console.info(410, 'to', `ctx.${context.sourceCode.getText(node.parent).substring('this.'.length)}`);
                    }
                    context.report({
                        node,
                        message: 'Change to ctx.logger',
                        fix: (fixer) => fixer.replaceText(node.parent, `ctx.${context.sourceCode.getText(node.parent).substring('this.'.length)}`),
                    });
                }
            },
        };

        function fixGetContext(node) {

            if (rootFuncState !== state) return;

            anyContextInFile |= rootFuncState.exported || rootFuncState.hasCtx;
            const getCtx = `${rootFuncState.hasCtx ? 'const ctx = ' : ''}${rootFuncState.exported
                ? `${CONTEXT_CLASS}.getSafe('${state.methodName}', this)`
                : `${CONTEXT_CLASS}.get('${state.methodName}')`}`;

            if (debug.enabled) {
                console.info(300, 'getCtx', getCtx);
                console.info(310, 'rootFuncState.ctxNode', !!rootFuncState.ctxNode);
            }

            const openingBracketToken = context.sourceCode.getFirstToken(node.body || node.value?.body);
            const tokenBeforeCtxNode = rootFuncState.ctxNode ? context.sourceCode.getTokenBefore(rootFuncState.ctxNode) : undefined;

            let ctxText = context.sourceCode.getText(rootFuncState.ctxNode);
            if (ctxText.endsWith(';')) ctxText = ctxText.substring(0, ctxText.length - 1);
            if (openingBracketToken === tokenBeforeCtxNode && ctxText === getCtx) return; // it's already right

            if (rootFuncState.ctxNode) {
                if (debug.enabled) {
                    console.info(370, 'fix', context.sourceCode.getText(rootFuncState.ctxNode));
                    console.info(380, 'to', getCtx);
                }
                context.report({
                    node: rootFuncState.ctxNode,
                    message: 'Fix',
                    fix: (fixer) => [
                        fixer.insertTextAfter(openingBracketToken, `${getCtx}`),
                        fixer.removeRange([rootFuncState.ctxNode.range[0], rootFuncState.ctxNode.range[1] + 1]),
                    ],
                });
            } else {
                if (debug.enabled) {
                    console.info(390, 'add', getCtx);
                }
                context.report({
                    node: node,
                    message: 'Add "{{ getCtx }}"',
                    data: {getCtx},
                    fix: (fixer) => fixer.insertTextAfter(openingBracketToken, getCtx),
                });
            }
        }

        function fixSetTimeoutAndSetInterval(node) {
            const fnOrAwaitNode = node.arguments[0];

            rootFuncState.hasCtx = true;

            const fnNode = fnOrAwaitNode.type === 'AwaitExpression' ? fnOrAwaitNode.argument : fnOrAwaitNode;

            const isAlreadyWrapped = fnNode.type === 'CallExpression'
                && (fnNode.callee.name === 'ctx' || fnNode.callee.object?.name === 'ctx');

            const wrappedArgumentNode = isAlreadyWrapped ? fnNode.arguments[0] : undefined;

            const callWithoutWrapInParentheses = !!(wrappedArgumentNode
                || fnNode.type === 'Identifier'
                || fnOrAwaitNode.type === 'CallExpression');

            const before = wrappedArgumentNode
                ? 'ctx.doHandleError('
                : callWithoutWrapInParentheses
                    ? 'ctx.doHandleError(() => '
                    : 'ctx.doHandleError(() => (';
            const after = wrappedArgumentNode ? ')' : callWithoutWrapInParentheses ? '())' : ')())';

            if (debug.enabled) {
                console.info(200, 'fnOrAwaitNode', context.sourceCode.getText(fnOrAwaitNode))
                console.info(210, 'fnNode', context.sourceCode.getText(fnNode))
                console.info(220, 'isAlreadyWrapped', isAlreadyWrapped)
                console.info(230, 'wrappedArgumentNode', wrappedArgumentNode ? context.sourceCode.getText(wrappedArgumentNode) : false)
                console.info(240, 'callWithoutWrapInParentheses', callWithoutWrapInParentheses)
                console.info(250, 'before', before)
                console.info(260, 'after', after)
            }

            let fnText = context.sourceCode.getText(fnOrAwaitNode);
            if (fnText.endsWith(';')) fnText = fnText.substring(0, fnText.length - 1);
            if (fnText.startsWith(before) && fnText.endsWith(after)) return; // already correctly wrapped

            if (debug.enabled) {
                console.info(280, 'fix', context.sourceCode.getText(fnOrAwaitNode));
                console.info(290, 'by', `${before}${wrappedArgumentNode
                    ? context.sourceCode.getText(wrappedArgumentNode)
                    : context.sourceCode.getText(fnOrAwaitNode)}${after}`);
            }

            context.report({
                node: fnOrAwaitNode,
                message: wrappedArgumentNode ? 'Fix' : `Add {{before}}...{{after}}`,
                data: {before, after},
                fix: (fixer) => fixer.replaceText(fnOrAwaitNode,
                    `${before}${wrappedArgumentNode
                        ? context.sourceCode.getText(wrappedArgumentNode)
                        : context.sourceCode.getText(fnOrAwaitNode)}${after}`),
            });
        }

        function fixCtxDo(node) {
            // wrap calls
            const wrappedExpression = (() => { // await? ctx.do?(() => ...)
                let res = node;
                if (res.parent.type !== 'ArrowFunctionExpression') return; // () => ...
                res = res.parent;
                if (res.parent.type !== 'CallExpression') return; // ctx.do...(() => ...)
                res = res.parent;
                if (res.callee.name === 'ctx' || res.callee.object?.name === 'ctx') { // within ctx.do...
                    if (res.callee.property?.name === 'doHandleError') return true; // keep it
                    if (res.parent.type === 'AwaitExpression') res = res.parent; // await ctx.do...(() => ...)
                    return res;
                }
            })();

            if (wrappedExpression === true) { // it's already wrapped into ctx.doHandleError
                if (debug.enabled) {
                    console.info(105, 'do not touch');
                }
                return;
            }

            // const objOrFunctionName = node.callee.name || node.callee.object?.name;
            const objOrFunctionName = getLeftmostName(node.callee);

            if (debug.enabled) {
                console.info(100, 'node', context.sourceCode.getText(node));
                console.info(110, 'wrappedExpression', wrappedExpression ? context.sourceCode.getText(wrappedExpression) : false);
                console.info(120, 'objOrFunctionName', objOrFunctionName);
                console.info(130, 'state.async', rootFuncState.async);
            }

            if ((state.ignore || state.prevIgnore)[objOrFunctionName]) { // not suppose to be wrapped
                if (wrappedExpression) {
                    if (debug.enabled) {
                        console.info(160, 'fix', context.sourceCode.getText(wrappedExpression));
                        console.info(170, 'by', context.sourceCode.getText(node));
                    }

                    context.report({
                        node: wrappedExpression,
                        message: `ctx.{{method}} is redundant`,
                        data: {method: node.parent.parent.callee.object.property},
                        fix: fixer => fixer.replaceText(wrappedExpression, context.sourceCode.getText(node)),
                    });
                }
            } else {
                rootFuncState.hasCtx = true;

                // const before = `${rootFuncState.async ? 'await ' : ''}ctx.${rootFuncState.async ? 'do' : 'doSync'}(() => `; // TODO: Fix later
                const hasAwait = wrappedExpression?.type === 'AwaitExpression';
                const before = `${hasAwait ? 'await ' : ''}ctx.${hasAwait ? 'do' : 'doSync'}(() => `;
                const after = `)`;

                if (wrappedExpression) {
                    let exp = context.sourceCode.getText(wrappedExpression);
                    if (exp.endsWith(';')) exp = exp.substring(0, exp.length - 1); // remove trailing semicolon
                    if (exp.startsWith(before) && exp.endsWith(after)) return; // already properly wrapped
                }

                const nodeToChange = node.parent === 'AwaitExpression' ? node.parent : node;

                if (debug.enabled) {
                    console.info(180, 'fix', context.sourceCode.getText(wrappedExpression || node));
                    console.info(190, 'by', `${before}${context.sourceCode.getText(node)}${after}`);
                }

                context.report({
                    node: wrappedExpression || node,
                    message: wrappedExpression ? 'Fix' : `Add {{before}}...{{after}}`,
                    data: {before, after},
                    fix: fixer => fixer.replaceText(wrappedExpression || nodeToChange, `${before}${context.sourceCode.getText(node)}${after}`),
                });
            }
        }

        /**
         * Adds, removes or updates import CONTEXT_CLASS from 'CONTEXT_CLASS_PATH'; depending on anyContextInFile variable.
         */
        function fixImportContext(context, node) {
            const classPath = path.join(
                path.relative(
                    path.parse(context.filename).dir, context.cwd),
                SRC_PATH,
                CONTEXT_CLASS_PATH)
                .replace(/\\/g, '/');

            const importContext = `import { ${CONTEXT_CLASS} } from '${classPath}'`;

            if (importContextNode) {
                // remove import
                if (!anyContextInFile) {
                    context.report({
                        node: importContextNode,
                        message: 'Remove import since it is not required',
                        fix: fixer => fixer.removeRange([importContextNode.range[0], importContextNode.range[1] + 1]),
                    });
                }

                // keep as it is
                let currentImport = context.sourceCode.getText(importContextNode);
                if (currentImport.endsWith(';')) currentImport = currentImport.substring(0, currentImport.length - 1);
                if (currentImport) return;

                // update to preper import
                context.report({
                    node: importContextNode,
                    message: 'Fix import to "{{ importContext }}"',
                    data: {importContext},
                    fix: fixer => fixer.replaceText(importContextNode, importContext),
                });
            } else if (anyContextInFile && lastImportDeclarationNode) { // add as last import
                context.report({
                    node: lastImportDeclarationNode,
                    message: 'Add "{{ importContext }}"',
                    data: {importContext},
                    fix: fixer => fixer.insertTextAfter(lastImportDeclarationNode, `\n${importContext}`),
                });
            } else if (anyContextInFile) { // add as first import
                context.report({
                    node: programNode,
                    message: 'Add "{{ importContext }}"',
                    data: {importContext},
                    fix: fixer => fixer.insertTextBeforeRange([0, 0], `${importContext}\n`),
                });
            }
        }

        /**
         * Recursive function to get names from construction like
         * `const {
         *     b1, b2, b3: d3, b4: { d4, d5 },
         * } = require('...');`
         *
         * The will be `b1, b2, d3, d4, d5`. And it will be added to `state.ignore` array.
         */
        function listVariableNames(variableDeclaratorOrObjectPattern) {
            switch (variableDeclaratorOrObjectPattern.type) {
                case 'Identifier':
                    (state.ignore || (state.ignore = Object.create(state.prevIgnore)))[variableDeclaratorOrObjectPattern.name] = true;
                    break;
                case 'Property':
                    if (variableDeclaratorOrObjectPattern.value.type === 'ObjectPattern') {
                        listVariableNames(variableDeclaratorOrObjectPattern.value);
                    } else {
                        (state.ignore || (state.ignore = Object.create(state.prevIgnore)))[variableDeclaratorOrObjectPattern.key.name] = true;
                    }
                    break;
                case 'ObjectPattern':
                    variableDeclaratorOrObjectPattern.properties.forEach(prop => listVariableNames(
                        prop.type === 'ObjectPattern' ? prop.value : prop));
                    break;
                default:
                    throw new Error(`Unexpected type: ${variableDeclaratorOrObjectPattern.type}`);
            }
        }

        function getLeftmostName(node) {
            console.info(1000, node)
            if (node.type === 'Identifier') return node.name;
            if (node.type === 'MemberExpression') return getLeftmostName(node.object);
        }
    },
};
