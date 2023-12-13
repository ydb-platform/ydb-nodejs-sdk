const path = require('path');
const debug = require('debug')('rule:context');

// TODO: Would optimize an result, if we will trace that object being created from IGNORED package

const TRACE_ANONYMOUSE = false;

const STATE_CLASS = 'class';
const STATE_FUNC = 'func';
const STATE_METHOD = 'method';

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
            type: 'root', // class, method, func
            ignore: IGNORE_GLOBALS, // variables and objects to be considered as global, so there is no sense to wrap them in ctx.do...
            traceName: null, // hierarchical name of function to be used as tracing unique name
            // async: false, // true, function has async flag
            // decorator: false, // returned function is a wrapper for a class method
            // root: false, // it's level of function there ctx, suppose to be declared
            // hasCtx: false, // true - at least one line with ctx.do...
            // ctxNode: undefined, // line with CONTEXT_CLASS.get or CONTEXT_CLASS.safeGet
            // stripped: // no paranthesis in arraow function
        };

        let rootFuncState;

        const filenameParsed = path.parse(context.filename);
        const folderPrefix = path.relative(path.join(process.cwd(), SRC_PATH), filenameParsed.dir)
            .replace(/[\\/]/g, '.');

        const pushToStack = (type, name, opts) => {
            stack.push(state);
            delete opts.decorator; // This value was considered before, and is removed to do not cause any confusion
            const anonymouse = !name;
            if (!name && TRACE_ANONYMOUSE) name = `${filenameParsed.name}_${(++anonymouseIndex).toString()}`;
            state = {
                ...opts,
                type,
                traceName: !name
                    ? state.traceName // from previous
                    : state.traceName === null
                        ? `${TRACKING_PREFIX}${folderPrefix.length > 0 ? `${folderPrefix}.` : ''}${name}` // start from the beggining
                        : `${state.traceName}${TRACKING_DELIMITER}${name}`, // add to previouse level
                prevIgnore: state.ignore || state.prevIgnore,
            };
            if (anonymouse) state.anonymouse = true;

            if ((!rootFuncState && ~[STATE_FUNC, STATE_METHOD].findIndex(v => v === state.type)) || opts.root) {
                rootFuncState = state;
                state.root = true;
            }
        };

        const popFromStack = () => {
            if (state.type === 'root') throw new Error('Already in the root');
            if (rootFuncState === state) {
                state = stack.pop();
                rootFuncState = stack.findLast(v => v.root);
            } else {
                state = stack.pop();
            }
        }

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
                    state.ctxNode = line;
                    return;
                }

                if (~['setTimeout', 'setInterval'].findIndex(v => v === node.callee.name)) {
                    // wrap setTimeout, setInterval
                    // fixSetTimeoutAndSetInterval(node); // TODO: Fix
                    return;
                }

                // wrap other calls
                fixCtxDo(node);
            },

            // classes
            'ClassDeclaration'(node) {
                debug('ClassDeclaration');
                pushToStack(STATE_CLASS, node.id.name, {});
            },
            'ClassDeclaration:exit'(node) {
                debug('ClassDeclaration:exit');
                popFromStack();
            },

            // functions and methods
            'ArrowFunctionExpression'(node) {
                debug('ArrowFunctionExpression');
                const opts = {async: node.async};
                if (node.body.type !== 'BlockStatement') {
                    opts.stripped = true;
                }
                getAnnotations(node, opts);
                if (node.parent.type === 'PropertyDefinition') {
                    if ('accessibility' in node.parent) opts.accessibility = node.parent.accessibility;
                    pushToStack(node.parent.static && !opts.decorator ? STATE_FUNC : STATE_METHOD, node.parent.key.name, opts);
                } else if (node.parent.type === 'VariableDeclarator' && node.parent.parent.type === 'VariableDeclaration' && node.parent.parent.kind === 'const') {
                    // const А = () => ... is a name method, but with let or def will be considered as anonymouse
                    pushToStack(STATE_FUNC, node.parent.id.name, opts);
                } else {
                    pushToStack(STATE_FUNC, null, opts);
                }
                // if (debug.enabled) {
                //     console.info(600, state);
                // }
            },
            'ArrowFunctionExpression:exit'(node) {
                debug('ArrowFunctionExpression:exit');
                fixGetContext(node);
                popFromStack();
            },
            'FunctionDeclaration'(node) {
                const opts = {async: node.async};
                getAnnotations(node, opts);
                pushToStack(STATE_FUNC, node.id.name, opts);
                // if (debug.enabled) {
                //     console.info(640, state);
                // }
            },
            'FunctionExpression'(node) {
                debug('FunctionExpression');
                const opts = {async: node.async};
                getAnnotations(node, opts);
                if (node.parent.type === 'MethodDefinition') { // method of a class
                    if ('accessibility' in node.parent) opts.accessibility = node.parent.accessibility;
                    pushToStack(node.parent.static && !opts.decorator ? STATE_FUNC : STATE_METHOD,
                        ~['get', 'set'].indexOf(node.parent.kind)
                            ? `${node.parent.kind}${TRACKING_DELIMITER}${node.parent.key.name}`
                            : node.parent.key.name,
                        opts);
                } else { // stand along function
                    pushToStack(STATE_FUNC, node.id?.name, opts);
                }
                // if (debug.enabled) {
                //     console.info(680, state);
                // }
            },
            'FunctionExpression:exit'(node) {
                debug('FunctionExpression:exit');
                fixGetContext(node);
                popFromStack();
            },

            // this.logger fix
            'ThisExpression'(node) {
                fixThisLogger(node);
            },
        };

        function fixGetContext(node) {

            if (rootFuncState !== state) { // this level is not suppose to has ctx declaration
                if (state.ctxNode) {
                    return {
                        node,
                        message: 'Remove ctx declaration',
                        fix: (fixer) => fixer.removeRange([rootFuncState.ctxNode.range[0], rootFuncState.ctxNode.range[1] + 1]),
                    }
                }
                return;
            }

            anyContextInFile = true; // TODO: Add span/noSpan annotation
            const getCtx = `${rootFuncState.hasCtx ? 'const ctx = ' : ''}${rootFuncState.type === STATE_METHOD
                ? `${CONTEXT_CLASS}.getSafe('${state.traceName}', this)`
                : `${CONTEXT_CLASS}.get('${state.traceName}')`}`;

            // if (debug.enabled) {
            //     console.info(300, 'getCtx', getCtx);
            //     console.info(310, 'rootFuncState.ctxNode', !!rootFuncState.ctxNode);
            // }

            const openingBracketToken = context.sourceCode.getFirstToken(node.body || node.value?.body);
            const tokenBeforeCtxNode = rootFuncState.ctxNode ? context.sourceCode.getTokenBefore(rootFuncState.ctxNode) : undefined;

            if (rootFuncState.ctxNode) {
                let ctxText = context.sourceCode.getText(rootFuncState.ctxNode);
                if (ctxText.endsWith(';')) ctxText = ctxText.substring(0, ctxText.length - 1);
                if (openingBracketToken === tokenBeforeCtxNode && ctxText === getCtx) return; // it's already right
                // if (debug.enabled) {
                //     console.info(370, 'fix', context.sourceCode.getText(rootFuncState.ctxNode));
                //     console.info(380, 'to', getCtx);
                // }
                context.report({
                    node: rootFuncState.ctxNode,
                    message: 'Fix to "{{ getCtx }}"',
                    data: {getCtx},
                    fix: (fixer) => [
                        fixer.removeRange([rootFuncState.ctxNode.range[0], rootFuncState.ctxNode.range[1] + 1]),
                        fixer.insertTextAfter(openingBracketToken, `${getCtx}`),
                    ],
                });
            } else {
                if (debug.enabled) {
                    console.info(390, 'add', getCtx);
                }
                console.info(3000, openingBracketToken)
                console.info(3100, context.sourceCode.getText(node.body))
                console.info(3200, openingBracketToken.value === '{')
                context.report({
                    node: node,
                    message: 'Add "{{ getCtx }}"',
                    data: {getCtx},
                    fix: (fixer) => openingBracketToken.value === '{'
                        ? fixer.insertTextAfter(openingBracketToken, getCtx)
                        : fixer.replaceText(node.body, `{ ${getCtx}\nreturn ${context.sourceCode.getText(node.body)} }`)
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

            // if (debug.enabled) {
            //     console.info(200, 'fnOrAwaitNode', context.sourceCode.getText(fnOrAwaitNode))
            //     console.info(210, 'fnNode', context.sourceCode.getText(fnNode))
            //     console.info(220, 'isAlreadyWrapped', isAlreadyWrapped)
            //     console.info(230, 'wrappedArgumentNode', wrappedArgumentNode ? context.sourceCode.getText(wrappedArgumentNode) : false)
            //     console.info(240, 'callWithoutWrapInParentheses', callWithoutWrapInParentheses)
            //     console.info(250, 'before', before)
            //     console.info(260, 'after', after)
            // }

            let fnText = context.sourceCode.getText(fnOrAwaitNode);
            if (fnText.endsWith(';')) fnText = fnText.substring(0, fnText.length - 1);
            if (fnText.startsWith(before) && fnText.endsWith(after)) return; // already correctly wrapped

            // if (debug.enabled) {
            //     console.info(280, 'fix', context.sourceCode.getText(fnOrAwaitNode));
            //     console.info(290, 'by', `${before}${wrappedArgumentNode
            //         ? context.sourceCode.getText(wrappedArgumentNode)
            //         : context.sourceCode.getText(fnOrAwaitNode)}${after}`);
            // }

            context.report({
                node: fnOrAwaitNode,
                message: wrappedArgumentNode ? 'Fix' : `Add {{before}}...{{after}}`,
                data: {
                    before,
                    after,
                },
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

            if ((wrappedExpression || node.parent).type === 'AwaitExpression') {
                state.async = true;
            }

            if (wrappedExpression === true) { // it's already wrapped into ctx.doHandleError
                if (debug.enabled) {
                    console.info(105, 'do not touch');
                }
                return;
            }

            const objOrFunctionName = getLeftmostName(node.callee);

            if (debug.enabled) {
                console.info(100, 'node', context.sourceCode.getText(node));
                console.info(110, 'wrappedExpression', wrappedExpression ? context.sourceCode.getText(wrappedExpression) : false);
                console.info(120, 'objOrFunctionName', objOrFunctionName);
                console.info(130, 'state.async', rootFuncState?.async);
                console.info(135, 'state.stripped', rootFuncState?.stripped);
            }

            if (!rootFuncState?.async || (state.ignore || state.prevIgnore)[objOrFunctionName]) { // not suppose to be wrapped
                if (wrappedExpression) {
                    // if (debug.enabled) {
                    //     console.info(160, 'fix', context.sourceCode.getText(wrappedExpression));
                    //     console.info(170, 'by', context.sourceCode.getText(node));
                    // }

                    context.report({
                        node: wrappedExpression,
                        message: `ctx.{{method}} is redundant`,
                        data: {method: node.parent.parent.callee.object.property},
                        fix: fixer => fixer.replaceText(wrappedExpression, context.sourceCode.getText(node)),
                    });
                }
            } else {
                rootFuncState.hasCtx = true;

                const hasAwait = wrappedExpression?.type === 'AwaitExpression';
                const before = `${hasAwait ? 'await ' : ''}ctx.${hasAwait ? 'do' : 'doSync'}(() => `;
                const after = `)`;

                if (wrappedExpression) {
                    let exp = context.sourceCode.getText(wrappedExpression);
                    if (exp.endsWith(';')) exp = exp.substring(0, exp.length - 1); // remove trailing semicolon
                    if (exp.startsWith(before) && exp.endsWith(after)) return; // already properly wrapped
                }

                const nodeToChange = node.parent === 'AwaitExpression' ? node.parent : node;

                // if (debug.enabled) {
                //     console.info(180, 'fix', context.sourceCode.getText(wrappedExpression || node));
                //     console.info(190, 'by', `${before}${context.sourceCode.getText(node)}${after}`);
                // }

                context.report({
                    node: wrappedExpression || node,
                    message: wrappedExpression ? 'Fix' : `Add {{before}}...{{after}}`,
                    data: {
                        before,
                        after,
                    },
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

            // if (debug.enabled) {
            //     console.info(700, 'anyContextInFile', anyContextInFile)
            //     console.info(710, 'importContext', importContext)
            // }

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

        function fixThisLogger(node) {
            // this.logger -> ctx.logger
            if (node.parent.type === 'MemberExpression' && node.parent.property.name === 'logger') {
                if (node.parent.parent.type === 'AssignmentExpression' && node.parent.parent.left === node.parent) return; // skip 'this.logger ='
                rootFuncState.hasCtx = true;
                // if (debug.enabled) {
                //     console.info(400, 'fix', context.sourceCode.getText(node.parent));
                //     console.info(410, 'to', `ctx.${context.sourceCode.getText(node.parent)
                //         .substring('this.'.length)}`);
                // }
                context.report({
                    node,
                    message: 'Change to ctx.logger',
                    fix: (fixer) => fixer.replaceText(node.parent, `ctx.${context.sourceCode.getText(node.parent)
                        .substring('this.'.length)}`),
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
            if (node.type === 'Identifier') return node.name;
            if (node.type === 'MemberExpression') return getLeftmostName(node.object);
        }

        function getAnnotations(node, opts) {
            const comments = context.sourceCode.getCommentsInside(node.parent);
            const decorator = comments.some(v => /(^|\W)@ctxDecorator(\W|$)/.test(v.value));
            const root = comments.some(v => /(^|\W)@ctxRoot(\W|$)/.test(v.value));
            if (decorator) opts.decorator = true;
            if (root) opts.root = true;
        }
    },
};
