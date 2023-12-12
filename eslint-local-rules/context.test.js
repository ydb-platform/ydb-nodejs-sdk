// import {RuleTester} from 'eslint';
// import * as Context from './context';
const {RuleTester} = require('@typescript-eslint/rule-tester');
const Context = require('./rules/context');

const ruleTester = new RuleTester;

describe('Test eslint rule', () => {
    ruleTester.run('context', Context, {
        valid: [
            `function Q() {
               F();
             }`,
            // '',
            // `function T() {
            //    ctx.doSync(F);
            //  }`,
            // '!@',
        ],
        invalid: [
            `function Q() {
               F();
             }`,
            // '!@'
        ],
    });
})
