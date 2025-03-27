// @ts-check

import { getConfigForTs } from 'eslint-config-wdzeng'

export default getConfigForTs(
  {
    'unicorn/no-process-exit': 'off'
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
