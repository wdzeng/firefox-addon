import fs from 'node:fs/promises'

import * as core from '@actions/core'
import { AxiosError } from 'axios'

export const ERR_XPI_FILE = 1
export const ERR_XPI_VALIDATION_FAILED = 2
export const ERR_XPI_VALIDATION_TIMEOUT = 4
export const ERR_UNKNOWN_HTTP = 254
export const ERR_UNKNOWN = 255

export function stringify(e: unknown): string {
  if (typeof e === 'object') {
    return JSON.stringify(e)
  }
  if (typeof e === 'string') {
    return e
  }
  return String(e)
}

export function getStringOrError(e: unknown): string | Error {
  return e instanceof Error ? e : stringify(e)
}

export function handleError(error: unknown): never {
  // HTTP error. This may be a bug on server side.
  if (error instanceof AxiosError) {
    if (error.response) {
      // Got response from FireFox API server with status code 4XX or 5XX.
      core.setFailed(`Firefox API server responses with error code: ${error.response.status}`)
      core.setFailed(getStringOrError(error.response.data))
    } else {
      // Incomplete HTTP request. This may be due to instable network environment.
      core.setFailed(error.message)
    }
    process.exit(ERR_UNKNOWN_HTTP)
  }

  // Unknown error. This may be a bug of this action.
  core.debug(stringify(error))
  if (error instanceof Error) {
    core.setFailed(`Unknown error occurred: ${error.message}`)
  } else {
    core.setFailed('Unknown error occurred.')
  }
  process.exit(ERR_UNKNOWN)
}

export async function requireXpiFileExists(path: string): Promise<void> {
  try {
    const s = await fs.stat(path)
    if (!s.isFile()) {
      core.setFailed(`Not a regular file: ${path}`)
      process.exit(ERR_XPI_FILE)
    }
    core.debug('The xpi file exists and is a regular file.')
  } catch {
    core.setFailed(`File not found: ${path}`)
    process.exit(ERR_XPI_FILE)
  }
}
