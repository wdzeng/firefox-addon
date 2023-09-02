import * as core from '@actions/core'
import { AxiosError } from 'axios'

import { handleError } from '@/error'
import { generateJwtToken, updateAddon, uploadXpi } from '@/firefox-addon-utils'

function requireEnvironmentVariable(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Environment variable ${key} is required.`)
  }
  return value
}

function requireVersionConflictError(e: unknown): void {
  if (!(e instanceof AxiosError)) {
    throw e
  }
  if (e.response?.status !== 409) {
    throw e
  }
  if (typeof e.response.data !== 'object') {
    throw e
  }

  const data = e.response.data as object
  if (!('version' in data)) {
    throw e
  }
  if (!Array.isArray(data.version) || data.version.length !== 1) {
    throw e
  }

  const errMsg = data.version[0] as unknown
  if (errMsg !== 'Version 0.0.0 already exists.') {
    throw e
  }
}

async function main() {
  const addonGuid = requireEnvironmentVariable('TEST_ADDON_GUID')
  const jwtIssuer = requireEnvironmentVariable('TEST_JWT_ISSUER')
  const jwtSecret = requireEnvironmentVariable('TEST_JWT_SECRET')

  const xpiPath = 'test/test-addon.zip'
  const license = undefined
  const selfHosted = true

  try {
    const jwtToken = generateJwtToken(jwtIssuer, jwtSecret)
    const uuid = await uploadXpi(xpiPath, jwtToken, selfHosted)
    try {
      await updateAddon(addonGuid, license, uuid, jwtToken)
    } catch (e: unknown) {
      requireVersionConflictError(e)
      core.info('Version conflict. This is expected result.')
    }
  } catch (e: unknown) {
    handleError(e)
  }
}

// Cannot use top-level await in the transpiled .cjs file.
void main()
