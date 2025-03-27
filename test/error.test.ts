import { AxiosError } from 'axios'
import { CustomError } from 'ts-custom-error'
import { expect, test, vi } from 'vitest'

import {
  ERR_UNKNOWN,
  ERR_UNKNOWN_HTTP,
  FirefoxAddonActionError,
  convertErrorToString,
  handleError
} from '@/error'

test('convertErrorToString', () => {
  expect(convertErrorToString(new Error('hello'))).toBe('hello')
  expect(convertErrorToString('hello')).toBe('hello')
  expect(convertErrorToString(42)).toBe('42')
  expect(convertErrorToString([1, 2, 3])).toBe('[1,2,3]')
  expect(convertErrorToString({ foo: 'bar' })).toBe('{"foo":"bar"}')
  expect(convertErrorToString(null)).toBe('null') // eslint-disable-line unicorn/no-null
  expect(convertErrorToString(undefined)).toBe('undefined')
})

test('handleError', () => {
  class ProcessExitError extends CustomError {
    constructor(readonly code: string | number | null | undefined) {
      super(`Process exited with code ${code}`)
    }
  }

  const spy = vi
    .spyOn(process, 'exit')
    .mockImplementation((exitCode: string | undefined | null | number) => {
      throw new ProcessExitError(exitCode)
    })

  expect(() => {
    handleError(new FirefoxAddonActionError('message', 42))
  }).toThrow(new ProcessExitError(42))
  expect(() => {
    handleError(new AxiosError('hello'))
  }).toThrow(new ProcessExitError(ERR_UNKNOWN_HTTP))
  expect(() => {
    handleError(new Error('hello'))
  }).toThrow(new ProcessExitError(ERR_UNKNOWN))

  spy.mockRestore()
})
