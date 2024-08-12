import * as core from '@actions/core'
import { AxiosError } from 'axios'

import { stringify } from '@/utils'

export const ERR_XPI_FILE = 1
export const ERR_XPI_VALIDATION_FAILED = 2
export const ERR_XPI_VALIDATION_TIMEOUT = 4
export const ERR_INVALID_INPUT = 5
export const ERR_VERSION_NUMBER = 6
export const ERR_UNKNOWN_HTTP = 254
export const ERR_UNKNOWN = 255

export function convertErrorToString(e: unknown): string {
  return e instanceof Error ? e.message : stringify(e)
}

function getStringOrError(e: unknown): string | Error {
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
