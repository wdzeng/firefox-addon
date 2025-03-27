import fs from 'node:fs'

import * as core from '@actions/core'
import { globSync } from 'glob'

import { ERR_INVALID_INPUT, FirefoxAddonActionError } from '@/error'

export function stringify(e: unknown): string {
  if (typeof e === 'object') {
    return JSON.stringify(e)
  }
  if (typeof e === 'string') {
    return e
  }

  // Since e is not object, we can safely call String(e).
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(e)
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
