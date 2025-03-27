import fs from 'node:fs'

import * as core from '@actions/core'
import { globSync } from 'glob'

import { ERR_INVALID_INPUT, FirefoxAddonActionError } from '@/error'

import type { Compatibility } from '@/api-types'

export function stringifyForDebugging(e: unknown): string {
  if (typeof e === 'object') {
    return JSON.stringify(e)
  }
  if (typeof e === 'string') {
    return e.trim() ? e : '<empty string>'
  }

  // Since e is not object, we can safely call String(e).
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  const ret = String(e)
  return ret.trim() ? ret : '<empty string>'
}

function isStringToStringMapping(a: unknown): a is Record<string, string> {
  if (typeof a !== 'object' || a === null) {
    return false
  }
  for (const [k, v] of Object.entries(a)) {
    if (typeof k !== 'string' || typeof v !== 'string') {
      return false
    }
  }
  return true
}

export function tryResolveFile(pattern: string): string {
  const foundFiles = globSync(pattern)

  if (foundFiles.length < 1) {
    throw new FirefoxAddonActionError(`File not found: ${pattern}`, ERR_INVALID_INPUT)
  }
  if (foundFiles.length > 1) {
    throw new FirefoxAddonActionError(`Multiple files found: ${pattern}`, ERR_INVALID_INPUT)
  }

  const stat = fs.statSync(foundFiles[0]!)

  if (!stat.isFile()) {
    throw new FirefoxAddonActionError(`Not a regular file: ${pattern}`, ERR_INVALID_INPUT)
  }

  return foundFiles[0]!
}

export function validateAndParseReleaseNotesInput(
  releaseNotesInput: string | undefined
): Record<string, string> | undefined {
  if (!releaseNotesInput) {
    return undefined
  }

  let ret: unknown
  try {
    ret = JSON.parse(releaseNotesInput)
  } catch {
    throw new FirefoxAddonActionError(
      `Input "release-notes" is not a valid JSON string: ${releaseNotesInput}`,
      ERR_INVALID_INPUT
    )
  }

  if (!isStringToStringMapping(ret)) {
    throw new FirefoxAddonActionError(
      `Input "release-notes" is not a string-to-string mapping: ${JSON.stringify(ret)}`,
      ERR_INVALID_INPUT
    )
  }

  return Object.keys(ret).length ? ret : undefined
}

export function requireValidXpiFileExtensionName(path: string) {
  const allowedExtensions = ['.zip', '.xpi', '.crx']
  if (!allowedExtensions.some(ext => path.endsWith(ext))) {
    throw new FirefoxAddonActionError(
      `Input "xpi-path" must have a valid extension name (.zip, .xpi, .crx): ${path}`,
      ERR_INVALID_INPUT
    )
  }
}

export function requireValidSourceFileExtensionName(path: string) {
  const allowedExtensions = ['.zip', '.tar.gz', '.tgz', '.tar.bz2']
  if (!allowedExtensions.some(ext => path.endsWith(ext))) {
    throw new FirefoxAddonActionError(
      `Input "source-file-path" must have a valid extension name (.zip, .tar.gz, .tgz, .tar.bz2): ${path}`,
      ERR_INVALID_INPUT
    )
  }
}

export function validateAndParseCompatibilityInput(
  compatibility: string | undefined
): Compatibility | undefined {
  if (!compatibility) {
    return undefined
  }

  // Check if this is a JSON object.
  if (compatibility.startsWith('{')) {
    // Compatibility is a JSON object.

    let ret

    try {
      ret = JSON.parse(compatibility) as object
    } catch {
      throw new FirefoxAddonActionError(
        `Input "compatibility" is not a valid JSON string: ${compatibility}`,
        ERR_INVALID_INPUT
      )
    }

    for (const v of Object.values(ret)) {
      if (v === null || !(v instanceof Object)) {
        throw new FirefoxAddonActionError(
          `Unexpected non-object value in compatibility field: ${stringifyForDebugging(v)}`,
          ERR_INVALID_INPUT
        )
      }
      const keys = Object.keys(v as object)
      const invalidKey = keys.find(k => k !== 'max' && k !== 'min')
      if (invalidKey) {
        throw new FirefoxAddonActionError(
          `Unexpected keys in compatibility field: ${invalidKey}; expected "min" and/or "max"`,
          ERR_INVALID_INPUT
        )
      }

      const values = Object.values(v as object) as unknown[]
      const invalidValue = values.find(w => typeof w !== 'string' || !w)
      if (invalidValue) {
        throw new FirefoxAddonActionError(
          `Unexpected values in compatibility field: ${stringifyForDebugging(invalidValue)}; expected non-empty string`,
          ERR_INVALID_INPUT
        )
      }
    }

    core.debug('Parse compatibility as an object.')
    return ret as Compatibility
  }

  // Compatibility is a comma-separated list of keys.
  const ret = compatibility.split(',').map(v => v.trim())
  if (ret.includes('')) {
    throw new FirefoxAddonActionError(
      `Invalid compatibility field: empty string found in keys: ${compatibility}`,
      ERR_INVALID_INPUT
    )
  }
  if (new Set(ret).size !== ret.length) {
    throw new FirefoxAddonActionError(
      `Found duplicate keys in compatibility field: ${compatibility}`,
      ERR_INVALID_INPUT
    )
  }

  core.debug('Parse compatibility as a comma-delimited array.')
  return ret as Compatibility
}

export function isGitHubAction(): boolean {
  // https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/store-information-in-variables#default-environment-variables
  return process.env.GITHUB_ACTIONS === 'true'
}

export interface Logger {
  setFailed(message: string | Error): void
  error(message: string): void
  warning(message: string): void
  info(message: string): void
  debug(message: string): void
}

class StderrLogger implements Logger {
  setFailed(message: string | Error): void {
    console.error(message)
  }
  error(message: string): void {
    console.error(message)
  }
  warning(message: string): void {
    console.error(message)
  }
  info(message: string): void {
    console.error(message)
  }
  debug(message: string): void {
    console.error(message)
  }
}

export const logger: Logger = isGitHubAction() ? core : new StderrLogger()
