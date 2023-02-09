module.exports = {
  // globals: {
  //     'ts-jest': {
  //         tsconfig: 'tsconfig-cjs.json'
  //     }
  // },
  roots: ['<rootDir>/tests'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testRegex: '(/tests/.*|(\\.|/)(test|spec))\\.tsx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
}
