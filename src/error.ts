import { AxiosError } from 'axios'
import { CustomError } from 'ts-custom-error'

import { logger, stringify } from '@/utils'

export const ERR_XPI_VALIDATION_FAILED = 2
export const ERR_XPI_VALIDATION_TIMEOUT = 4
export const ERR_INVALID_INPUT = 5
export const ERR_VERSION_NUMBER = 6
export const ERR_UNKNOWN_HTTP = 254
export const ERR_UNKNOWN = 255

export class FirefoxAddonActionError extends CustomError {
  constructor(
    message: string,
    readonly code: number
  ) {
    super(message)
  }
}

export function convertErrorToString(e: unknown): string {
  return e instanceof Error ? e.message : stringify(e)
}

function getStringOrError(e: unknown): string | Error {
  return e instanceof Error ? e : stringify(e)
}

export function handleError(error: unknown): never {
  if (error instanceof FirefoxAddonActionError) {
    logger.setFailed(error.message)
    process.exit(error.code)
  }

  // HTTP error. This may be a bug on server side.
  if (error instanceof AxiosError) {
    if (error.response) {
      // Got response from FireFox API server with status code 4XX or 5XX.
      logger.setFailed(`Firefox API server responses with error code: ${error.response.status}`)
      logger.setFailed(getStringOrError(error.response.data))
    } else {
      // Incomplete HTTP request. This may be due to instable network environment.
      logger.setFailed(error.message)
    }
    process.exit(ERR_UNKNOWN_HTTP)
  }

  // Unknown error. This may be a bug of this action.
  let str_err = stringify(error)
  if (str_err.length > 256) {
    str_err = `${str_err.slice(0, 256)} <truncated>`
  }
  logger.debug(str_err)
  if (error instanceof Error) {
    logger.setFailed(`Unknown error occurred: ${error.message}`)
  } else {
    logger.setFailed('Unknown error occurred.')
  }
  process.exit(ERR_UNKNOWN)
}
