// @ts-check

import { getConfigForTs } from 'eslint-config-wdzeng'

export default getConfigForTs(
  {
    'unicorn/no-process-exit': 'off',
    'unicorn/prefer-top-level-await': 'off',
    'n/no-unsupported-features/node-builtins': [
      'error',
      {
        // TODO: Find if there is a good alternative for fs.openAsBlob.
        ignores: ['fs.openAsBlob']
      }
    ]
  },
  {
    projectRoot: import.meta.dirname,
    node: true,
    browser: false,
    vitest: true,
    ignores: ['dist'],
    ecmaVersion: 2022
  }
)
