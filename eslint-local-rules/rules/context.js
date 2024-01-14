// TODO: Would optimize an result, if we will trace that object being created from IGNORED package
// TODO: do not wrap .bind()
// TODO: wrap whole body of sync func
// TODO: span directives
// TODO: wrapper for async func should have async

const path = require('path');
const _ = require('lodash');
const debug = require('debug')('rule:context');

const STATE_ROOT = 'root';
const STATE_PROGRAM = 'program';
const STATE_CLASS = 'class';
const STATE_FUNC = 'func';
const STATE_METHOD = 'method';

const CTX_AFTER_SUPER = false;
const SRC_PATH = '/src';
const CONTEXT_CLASS = 'ContextWithLogger';
const CONTEXT_CLASS_PATH = '/context-with-logger';
const TRACKING_PREFIX = 'ydb-nodejs-sdk:';
const TRACKING_DELIMITER = '.';

const OPTS_KEYS = ['trace', 'anonymTrace', 'root', 'span', 'decorator'];

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

let itCount = 0;

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

        if (itCount >= 2) return {}

        /**
         * Nesting levels
         */
        const stack = [];

        let state = {
            type: STATE_ROOT, // class, method, func
            ignore: IGNORE_GLOBALS, // variables and objects to be considered as global, so there is no sense to wrap them in ctx.do...
            traceName: null, // hierarchical name of function to be used as tracing unique name
            trace: true,
            anonymTrace: false,
            // async: false, // true, function has async flag
            // decorator: false, // returned function is a wrapper for a class method
            // root: false, // it's level of function there ctx, suppose to be declared
            // hasCtx: false, // true - at least one line with ctx.do...
            // ctxNode: undefined, // line with CONTEXT_CLASS.get or CONTEXT_CLASS.safeGet
        };

        let rootFuncState;

        const filenameParsed = path.parse(context.filename);
        const folderPrefix = path.relative(path.join(process.cwd(), SRC_PATH), filenameParsed.dir)
            .replace(/[\\/]/g, '.');

        const pushToStack = (type, name, opts) => {
            const prevState = state;
            stack.push(state);
            delete opts.decorator; // This value was considered before, and is removed to do not cause any confusion
            const anonymouse = !name;
            if (!name && state.anonymTrace) name = `anon_${(++anonymouseIndex).toString().padStart(3, '0')}`;
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
            for (const key of OPTS_KEYS) // derive all opts from parent if they was not specified on this level
                if (prevState.hasOwnProperty(key) && !state.hasOwnProperty(key)) state[key] = prevState[key];
            const isFunc = !!~[STATE_METHOD, STATE_FUNC].findIndex(v => v === state.type);

            if (isFunc) {
                if (name === 'constructor') state.ctor = true;
                if (!opts.hasOwnProperty('root')) // if root flag is not specified in directives
                    state.root = !~[STATE_METHOD, STATE_FUNC].findIndex(v => v === prevState.type);
                if (!rootFuncState || state.root) {
                    rootFuncState = state;
                    anonymouseIndex = 0; // start anonymouse count on every root
                }
            } else {
                delete state.root; // root is only applicable for functions
            }

            if (state.type === STATE_PROGRAM) {
                delete state.anonymouse;
            }

            if (debug.enabled) {
                readableState = Object.keys(state).sort().reduce((a, k) => {
                    if (!~['ignore', 'prevIgnore'].findIndex(v => v === k)) a[k] = state[k];
                    return a;
                }, []);
                debug('state: %o', readableState);
            }
        };

        const popFromStack = () => {
            if (state.type === STATE_ROOT) throw new Error('Already in the root');
            const prevState = state;
            state = stack.pop();
            if (rootFuncState === prevState) rootFuncState = state.root ? state : stack.findLast(v => v.root);
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
                const opts = {};
                // console.info(5000, context.sourceCode.getCommentsBefore(node))
                getAnnotations(node, opts, node, false);
                pushToStack(STATE_PROGRAM, null, opts);
            },
            'Program:exit'(node) {
                debug('Program:exit');
                fixImportContext(context, node);
                popFromStack();
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

                // do not touch super();
                if (node.callee?.type === 'Super') return;

                // skip decorator calls
                if (node.parent.type === 'Decorator') return;

                // insert const ctx = ... only after super(), since it's not allowed use this.before
                if (CTX_AFTER_SUPER && node.callee.type === 'Super') {
                    state.ctxInsertPoint = node.range[1];
                }

                // context initialization
                if (node.callee.object?.name === CONTEXT_CLASS && ~['get', 'getNoSpan'].findIndex(v => v === node.callee.property.name)) {
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
                const opts = {};
                getAnnotations(node, opts, context.sourceCode.getFirstToken(node.body /* ClassBody */), true);
                pushToStack(STATE_CLASS, node.id.name, opts);
            },
            'ClassDeclaration:exit'(node) {
                debug('ClassDeclaration:exit');
                popFromStack();
            },

            // functions and methods
            'ArrowFunctionExpression'(node) {
                debug('ArrowFunctionExpression');

                const opts = {async: node.async};
                opts.block = node.body.type === 'BlockStatement';

                getAnnotations(node, opts, opts.block
                    ? context.sourceCode.getFirstToken(node.body /* BlockStatement */)
                    : node.body /* Literal, BinaryExpression, CallExpression ... */, opts.block);

                if (node.parent.type === 'CallExpression' && node.parent.callee.object?.name === 'ctx') {
                    pushToStack(STATE_FUNC, null, {...opts, skip: true}); // it's arrow function in ctx.do(() => ...)
                } else if (node.parent.type === 'PropertyDefinition') {
                    if ('accessibility' in node.parent) opts.accessibility = node.parent.accessibility; // TODO: Convert to key opts
                    pushToStack(node.parent.static && !opts.decorator ? STATE_FUNC : STATE_METHOD, node.parent.key.name, opts);
                } else if (node.parent.type === 'VariableDeclarator' && node.parent.parent.type === 'VariableDeclaration' && node.parent.parent.kind === 'const') {
                    // const А = () => ... is a name method, but with let or def will be considered as anonymouse
                    pushToStack(STATE_FUNC, node.parent.id.name, opts);
                } else {
                    pushToStack(STATE_FUNC, null, opts);
                }
            },
            'ArrowFunctionExpression:exit'(node) {
                debug('ArrowFunctionExpression:exit');
                if (!state.skip) fixGetContext(node);
                popFromStack();
            },
            'FunctionDeclaration'(node) {
                debug('FunctionDeclaration');
                const opts = {async: node.async};
                getAnnotations(node, opts, context.sourceCode.getFirstToken(node.body /* BlockStatement */), true);
                pushToStack(STATE_FUNC, node.id.name, opts);
            },
            'FunctionDeclaration:exit'(node) {
                debug('FunctionDeclaration:exit');
                fixGetContext(node);
                popFromStack();
            },
            'FunctionExpression'(node) {
                debug('FunctionExpression');
                const opts = {async: node.async};
                getAnnotations(node, opts, context.sourceCode.getFirstToken(node.body /* BlockStatement */), true);
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

        function fixCtxDo(node) {
            debug('fixCtxDo()');
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
                debug('return: do not touch')
                return;
            }

            const objOrFunctionName = getLeftmostName(node.callee);
            const hasAwait = (wrappedExpression || node.parent).type === 'AwaitExpression';

            if (debug.enabled) debug('name: %s, hasAwait: %s, async: %s, trace: %s, ignore: %s',
                objOrFunctionName,
                hasAwait,
                !!rootFuncState?.async,
                !!state.trace,
                !!(state.ignore || state.prevIgnore)[objOrFunctionName]);

            if (!state.trace || /* !rootFuncState?.async || */ (state.ignore || state.prevIgnore)[objOrFunctionName]) { // not suppose to be wrapped
                if (wrappedExpression) {
                    context.report({
                        node: wrappedExpression,
                        message: `ctx.{{method}} is redundant`,
                        data: {method: node.parent.parent.callee.property?.name},
                        fix: fixer => fixer.replaceText(wrappedExpression, context.sourceCode.getText(node)),
                    });

                    debug('return: add');
                }
                debug('return: not wrapped and not supoose to be')
            } else {
                rootFuncState.hasCtx = true;

                const before = `${hasAwait ? 'await ' : ''}ctx.${hasAwait ? 'do' : 'doSync'}(() => `;
                const after = `)`;

                if (wrappedExpression) {
                    let exp = context.sourceCode.getText(wrappedExpression);
                    if (exp.endsWith(';')) exp = exp.substring(0, exp.length - 1); // remove trailing semicolon
                    if (exp.startsWith(before) && exp.endsWith(after)) {
                        debug('return: already there')
                        return;
                    } // already properly wrapped
                }

                const nodeToChange = node.parent === 'AwaitExpression' ? node.parent : node;

                debug('return: fix');
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

        function fixGetContext(node) {
            debug('fixGetContext()');
            if (rootFuncState !== state || !state.trace) { // this level is not suppose to has ctx declaration
                if (state.ctxNode) {
                    context.report({
                        node,
                        message: 'Remove ctx declaration',
                        fix: (fixer) => [
                            fixer.removeRange([state.ctxNode.range[0], state.ctxNode.range[1] + 1]),
                        ],
                    });
                }
                return;
            }

            const isGetSafe = state.type === STATE_METHOD || state.decorator;

            anyContextInFile = true; // TODO: Add span/noSpan annotation
            const getCtxBefore = `${rootFuncState.hasCtx ? 'const ctx = ' : ''}${isGetSafe
                ? `${CONTEXT_CLASS}.getnoSpan('${state.traceName}',` // TODO: Support
                : `${CONTEXT_CLASS}.get('${state.traceName}'`}`;
            const getCtxAfter = ')';

            const openingBracketToken = context.sourceCode.getFirstToken(node.body || node.value?.body);
            const tokenBeforeCtxNode = rootFuncState.ctxNode ? context.sourceCode.getTokenBefore(rootFuncState.ctxNode) : undefined;

            if (rootFuncState.ctxNode) {
                let ctxText = context.sourceCode.getText(rootFuncState.ctxNode);

                const r = ctxText.match(/\.get(NoSpan)?\((.*,)*(.*)\)/);
                const logger = r ? r[2] : state.ctor ? '\'<logger>\'' : 'this';

                const getCtx = `${getCtxBefore}${logger}${getCtxAfter}`; // keep original pointer to logger

                if (ctxText.endsWith(';')) ctxText = ctxText.substring(0, ctxText.length - 1);
                if (openingBracketToken === tokenBeforeCtxNode && ctxText === getCtx) return; // it's already right

                context.report({
                    node: rootFuncState.ctxNode,
                    message: 'Fix to "{{ getCtx }}"',
                    data: {getCtx},
                    fix: (fixer) => [
                        fixer.replaceTextRange(state.ctxNode.range, getCtx), // keep line where statement was located
                    ],
                });
            } else {

                const getCtx = `${getCtxBefore}${!isGetSafe ? '' : (state.ctor ? '\'<logger>\'' : 'this')}${getCtxAfter}`; // keep original pointer to logger

                const fixedGetCtx = `\n${getCtx}`;

                context.report({
                    node: node,
                    message: 'Add "{{ getCtx }}"',
                    data: {getCtx},
                    fix: (fixer) => [
                        fixer.insertTextAfterRange([-1, state.ctxInsertPoint], fixedGetCtx), // starts with \n
                    ],
                });
            }
        }

        /**
         * Adds, removes or updates import CONTEXT_CLASS from 'CONTEXT_CLASS_PATH'; depending on anyContextInFile variable.
         */
        function fixImportContext(context, node) {
            debug('fixImportContext()');

            const classPath = path.join(
                path.relative(
                    path.parse(context.filename).dir, context.cwd),
                SRC_PATH,
                CONTEXT_CLASS_PATH)
                .replace(/\\/g, '/');

            const importContext = `import { ${CONTEXT_CLASS} } from '${classPath}'`;

            debug('importContextNode: %s, anyContextInFile: %s', !!importContextNode, !!anyContextInFile);

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
                const topComments = context.sourceCode.getCommentsAfter({range: [0, 0]});
                context.report({
                    node: programNode,
                    message: 'Add "{{ importContext }}"',
                    data: {importContext},
                    fix: fixer => topComments.length > 0
                        ? fixer.insertTextAfterRange(topComments[topComments.length - 1].range, `\n${importContext}\n`)
                        : fixer.insertTextBeforeRange(topComments.length >  [0, 0], `${importContext}\n`)
                });
            }
        }

        function fixSetTimeoutAndSetInterval(node) {
            debug('fixSetTimeoutAndSetInterval()');
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

            let fnText = context.sourceCode.getText(fnOrAwaitNode);
            if (fnText.endsWith(';')) fnText = fnText.substring(0, fnText.length - 1);
            if (fnText.startsWith(before) && fnText.endsWith(after)) return; // already correctly wrapped

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

        function fixThisLogger(node) {
            debug('fixThisLogger()');

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
            debug('listVariableNames()');

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

        function getAnnotations(node, opts, commentsNode, commentsAfter) {
            const comments = context[commentsAfter ? 'getCommentsAfter' : 'getCommentsBefore'](commentsNode);
            for (const comment of comments) {
                const r =  /^\s*local-rules\/context:(.*)$/gm.exec(comment.value);
                if (r) {
                    for (const attr of [...r[1].matchAll(/[\s,]*([\w\-_]*)/g)]
                        .reduce((a, v) => { if (v[1]) a.push(v[1]); return a; }, [])) {

                        const itsNo = attr.startsWith('no-');
                        const val = _.camelCase(_.kebabCase(itsNo ? attr.substring(3) : attr));

                        if (!~OPTS_KEYS.indexOf(val)) {
                            context.report({
                                node,
                                message: `Unexpected flag: ${attr}`,
                            });
                            continue;
                        }
                        opts[val] = !itsNo;
                    }
                }
            }

            opts.ctxInsertPoint = (comments.length > 0 ? comments[comments.length - 1] : commentsNode).range[1];
        }
    },
};
