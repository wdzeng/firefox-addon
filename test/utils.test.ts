import fs from 'node:fs'
import path from 'node:path'

import tmp from 'tmp'
import { describe, expect, test } from 'vitest'

import { ERR_INVALID_INPUT, FirefoxAddonActionError } from '@/error'
import {
  requireValidSourceFileExtensionName,
  requireValidXpiFileExtensionName,
  stringify,
  tryResolveFile,
  validateAndParseReleaseNotesInput
} from '@/utils'

test('stringify', () => {
  expect(stringify('hello')).toBe('hello')
  expect(stringify(42)).toBe('42')
  expect(stringify([1, 2, 3])).toBe('[1,2,3]')
  expect(stringify({ foo: 'bar' })).toBe('{"foo":"bar"}')
  expect(stringify(null)).toBe('null') // eslint-disable-line unicorn/no-null
  expect(stringify(undefined)).toBe('undefined')
})

describe('tryResolveFile', () => {
  test('happy path', () => {
    const tmpDir = tmp.dirSync({ keep: false, unsafeCleanup: true })
    fs.writeFileSync(path.join(tmpDir.name, 'foo.txt'), '')
    process.chdir(tmpDir.name)
    expect(tryResolveFile('foo.txt')).toBe('foo.txt')
  })

  test('happy path (glob)', () => {
    const tmpDir = tmp.dirSync({ keep: false, unsafeCleanup: true })
    fs.writeFileSync(path.join(tmpDir.name, 'foo.txt'), '')
    process.chdir(tmpDir.name)
    expect(tryResolveFile('*.txt')).toBe('foo.txt')
  })

  test('no file found', () => {
    /*
     * File system hierarchy:
     *
     * /tmp (working directory here)
     * └── foo/
     *     └── bar.txt
     *
     * We want to make sure when the working directory is /tmp, globbing ("bar.txt") should not find
     * the file (because its in a subdirectory).
     */
    try {
      const tmpDir = tmp.dirSync({ keep: false, unsafeCleanup: true })
      fs.mkdirSync(path.join(tmpDir.name, 'foo'))
      fs.writeFileSync(path.join(tmpDir.name, 'foo', 'bar.txt'), '')
      process.chdir(tmpDir.name)
      tryResolveFile('bar.txt')
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(FirefoxAddonActionError)
      expect(e).toHaveProperty('code', ERR_INVALID_INPUT)
    }
  })

  test('multiple files found', () => {
    try {
      const tmpDir = tmp.dirSync({ keep: false, unsafeCleanup: true })
      fs.writeFileSync(path.join(tmpDir.name, 'foo.txt'), '')
      fs.writeFileSync(path.join(tmpDir.name, 'bar.txt'), '')
      process.chdir(tmpDir.name)
      tryResolveFile('*.txt')
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(FirefoxAddonActionError)
      expect(e).toHaveProperty('code', ERR_INVALID_INPUT)
    }
  })

  test('directory', () => {
    try {
      tryResolveFile('/tmp')
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(FirefoxAddonActionError)
      expect(e).toHaveProperty('code', ERR_INVALID_INPUT)
    }
  })
})

test('validateAndParseReleaseNotesInput', () => {
  expect(validateAndParseReleaseNotesInput('{"foo": "bar"}')).toEqual({ foo: 'bar' })
  expect(validateAndParseReleaseNotesInput('')).toBeUndefined()
  expect(validateAndParseReleaseNotesInput('{}')).toBeUndefined()

  const errorCases = [
    '42',
    '"foo"',
    'false',
    'true',
    'null',
    '[1,2,3]',
    '{"foo": 42}',
    '{"foo": "bar", "baz": 42}',
    '{"foo'
  ]
  for (const input of errorCases) {
    try {
      validateAndParseReleaseNotesInput(input)
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(FirefoxAddonActionError)
      expect(e).toHaveProperty('code', ERR_INVALID_INPUT)
    }
  }
})

test('requireValidXpiFileExtensionName', () => {
  expect(() => requireValidXpiFileExtensionName('foo.zip')).not.toThrow()
  expect(() => requireValidXpiFileExtensionName('foo.xpi')).not.toThrow()
  expect(() => requireValidXpiFileExtensionName('foo.crx')).not.toThrow()

  const errorCases = ['foo', 'foo.tar', 'foo.tar.gz', 'foo.tgz', 'foo.tar.bz2', 'foo.png']
  for (const input of errorCases) {
    try {
      requireValidXpiFileExtensionName(input)
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(FirefoxAddonActionError)
      expect(e).toHaveProperty('code', ERR_INVALID_INPUT)
    }
  }
})

test('requireValidSourceFileExtensionName', () => {
  expect(() => requireValidSourceFileExtensionName('foo.zip')).not.toThrow()
  expect(() => requireValidSourceFileExtensionName('foo.tar.gz')).not.toThrow()
  expect(() => requireValidSourceFileExtensionName('foo.tgz')).not.toThrow()
  expect(() => requireValidSourceFileExtensionName('foo.tar.bz2')).not.toThrow()

  const errorCases = ['foo', 'foo.xpi', 'foo.crx', 'foo.png']
  for (const input of errorCases) {
    try {
      requireValidSourceFileExtensionName(input)
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(FirefoxAddonActionError)
      expect(e).toHaveProperty('code', ERR_INVALID_INPUT)
    }
  }
})
