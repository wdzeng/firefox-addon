import { openAsBlob } from 'node:fs'
import path from 'node:path'

import AdmZip from 'adm-zip'
import axios from 'axios'
import jwt from 'jsonwebtoken'

import type { UploadResponse } from '@/api-types'
import {
  ERR_VERSION_NUMBER,
  ERR_XPI_VALIDATION_FAILED,
  ERR_XPI_VALIDATION_TIMEOUT,
  FirefoxAddonActionError,
  convertErrorToString
} from '@/error'
import { logger, stringify } from '@/utils'

export function generateJwtToken(jwtIssuer: string, jwtSecret: string): string {
  // https://addons-server.readthedocs.io/en/latest/topics/api/auth.html#create-a-jwt-for-each-request
  logger.info('Start to generate JWT token.')
  const issuedAt = Math.floor(Date.now() / 1000) // Remove milliseconds.
  const payload = {
    exp: issuedAt + 5 * 60, // Set expiration time to 5 minutes.
    iat: issuedAt,
    iss: jwtIssuer,
    jti: Math.random().toString()
  }
  const jwtToken = jwt.sign(payload, jwtSecret, { algorithm: 'HS256' })
  logger.info('JWT token generated.')
  return jwtToken
}

async function createVersion(
  addonGuid: string,
  jwtToken: string,
  approvalNotes: string | undefined,
  license: string | undefined,
  releaseNotes: Record<string, string> | undefined,
  uploadUuid: string
) {
  logger.info('Start to create a version.')

  // https://addons-server.readthedocs.io/en/latest/topics/api/addons.html#version-create
  const url = `https://addons.mozilla.org/api/v5/addons/addon/${addonGuid}/versions/`
  const body = {
    approval_notes: approvalNotes,
    license,
    release_notes: releaseNotes,
    upload: uploadUuid
  }
  const headers = { Authorization: `jwt ${jwtToken}` }
  await axios.post(url, body, { headers })

  logger.info('Version created.')
}

async function createVersionSource(
  addonGuid: string,
  jwtToken: string,
  license: string | undefined,
  sourceFilePath: string,
  uploadUuid: string
) {
  logger.info('Start to create a version source.')

  // https://addons-server.readthedocs.io/en/latest/topics/api/addons.html#version-sources
  const url = `https://addons.mozilla.org/api/v5/addons/addon/${addonGuid}/versions/`
  const formData = new FormData()
  formData.append('upload', uploadUuid)
  formData.append('source', await openAsBlob(sourceFilePath), path.basename(sourceFilePath))
  if (license) {
    formData.append('license', license)
  }
  const headers = {
    'Authorization': `jwt ${jwtToken}`,
    'Content-Type': 'multipart/form-data'
  }
  await axios.post(url, formData, { headers })

  logger.info('Version source created.')
}

async function patchVersionSource(
  addonGuid: string,
  versionNumber: string,
  jwtToken: string,
  license: string | undefined,
  sourceFilePath: string
) {
  logger.info('Start to patch a version source.')

  // https://addons-server.readthedocs.io/en/latest/topics/api/addons.html#version-sources
  const url = `https://addons.mozilla.org/api/v5/addons/addon/${addonGuid}/versions/${versionNumber}/`
  const formData = new FormData()
  formData.append('source', await openAsBlob(sourceFilePath), path.basename(sourceFilePath))
  if (license) {
    formData.append('license', license)
  }
  const headers = {
    'Authorization': `jwt ${jwtToken}`,
    'Content-Type': 'multipart/form-data'
  }
  await axios.patch(url, formData, { headers })

  logger.info('Version source patched.')
}

function getAddonVersionNumber(xpiFilePath: string): string {
  const zip = new AdmZip(xpiFilePath)
  let manifest_content: string
  try {
    manifest_content = zip.readAsText('manifest.json', 'utf8')
  } catch (e: unknown) {
    logger.debug(convertErrorToString(e))
    throw new FirefoxAddonActionError(
      'Error getting addon version because failed to read manifest.json.',
      ERR_VERSION_NUMBER
    )
  }

  let manifest_json: unknown
  let ok = true
  try {
    manifest_json = JSON.parse(manifest_content)
    ok = manifest_json !== null && typeof manifest_json === 'object'
  } catch {
    ok = false
  }
  if (!ok) {
    logger.debug(`manifest.json: ${JSON.stringify(manifest_json)}`)
    throw new FirefoxAddonActionError(
      'Error getting addon version because failed to parse manifest.json. Is it a valid JSON file?',
      ERR_VERSION_NUMBER
    )
  }

  const manifest = manifest_json as Record<string, unknown>
  if (typeof manifest.version !== 'string' || !manifest.version) {
    logger.debug(`manifest.json: ${JSON.stringify(manifest_json)}`)
    throw new FirefoxAddonActionError(
      'Error getting addon version. Does manifest.json have a valid version field?',
      ERR_VERSION_NUMBER
    )
  }

  const version = manifest.version
  return version.startsWith('v') ? version : `v${version}`
}

export async function updateAddon(
  addonGuid: string,
  license: undefined | string,
  uploadUuid: string,
  jwtToken: string,
  approvalNotes: string | undefined,
  releaseNotes: Record<string, string> | undefined,
  sourceFilePath: string | undefined,
  xpiPath: string
) {
  if (sourceFilePath) {
    if (approvalNotes !== undefined || releaseNotes !== undefined) {
      const versionNumber = getAddonVersionNumber(xpiPath)
      await createVersion(addonGuid, jwtToken, approvalNotes, license, releaseNotes, uploadUuid)
      await patchVersionSource(addonGuid, versionNumber, jwtToken, license, sourceFilePath)
    } else {
      await createVersionSource(addonGuid, jwtToken, license, sourceFilePath, uploadUuid)
    }
  } else {
    await createVersion(addonGuid, jwtToken, approvalNotes, license, releaseNotes, uploadUuid)
  }
}

async function waitUntilXpiValidated(uploadUuid: string, jwtToken: string): Promise<void> {
  // https://addons-server.readthedocs.io/en/latest/topics/api/addons.html#upload-detail
  const MAX_WAIT_TIME = 10 * 60 * 1000 // 10 minutes

  const url = `https://addons.mozilla.org/api/v5/addons/upload/${uploadUuid}/`
  const endTime = Date.now() + MAX_WAIT_TIME
  const headers = { Authorization: `jwt ${jwtToken}` }

  while (Date.now() < endTime) {
    logger.info('xpi not yet validated. Wait 5 seconds.')
    await new Promise(res => setTimeout(res, 5000))

    logger.info('Checking if xpi is validated.')
    const response = await axios<UploadResponse>(url, { headers })

    if (response.data.processed) {
      if (response.data.valid) {
        return
      }

      const validationMsg = stringify(response.data.validation)
      throw new FirefoxAddonActionError(validationMsg, ERR_XPI_VALIDATION_FAILED)
    }
  }

  throw new FirefoxAddonActionError(
    'Timeout waiting for xpi validation.',
    ERR_XPI_VALIDATION_TIMEOUT
  )
}

async function createUpload(
  xpiPath: string,
  jwtToken: string,
  selfHosted: boolean
): Promise<string> {
  // https://addons-server.readthedocs.io/en/latest/topics/api/addons.html#upload-create
  const url = 'https://addons.mozilla.org/api/v5/addons/upload/'
  const formData = new FormData()
  formData.append('upload', await openAsBlob(xpiPath), path.basename(xpiPath))
  formData.append('channel', selfHosted ? 'unlisted' : 'listed')
  const headers = {
    'Authorization': `jwt ${jwtToken}`,
    'Content-Type': 'multipart/form-data'
  }
  const response = await axios.post<UploadResponse>(url, formData, { headers })
  logger.info('xpi file uploaded.')
  return response.data.uuid
}

export async function uploadXpi(
  xpiPath: string,
  jwtToken: string,
  selfHosted: boolean
): Promise<string> {
  // Send upload request.
  logger.info('Start to upload xpi file to firefox addons server.')

  const uploadUuid = await createUpload(xpiPath, jwtToken, selfHosted)
  await waitUntilXpiValidated(uploadUuid, jwtToken)

  logger.info('xpi processed.')
  return uploadUuid
}
