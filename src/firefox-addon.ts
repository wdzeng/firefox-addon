import { createReadStream } from 'node:fs'

import * as core from '@actions/core'
import axios from 'axios'
import FormData from 'form-data'
import jwt from 'jsonwebtoken'

import type { UploadResponse } from '@/api-types'
import { ERR_XPI_VALIDATION_FAILED, ERR_XPI_VALIDATION_TIMEOUT } from '@/error'
import { stringify } from '@/utils'

export function generateJwtToken(jwtIssuer: string, jwtSecret: string): string {
  // https://addons-server.readthedocs.io/en/latest/topics/api/auth.html#create-a-jwt-for-each-request
  core.info('Start to generate JWT token.')
  const issuedAt = Math.floor(Date.now() / 1000) // Remove milliseconds.
  const payload = {
    exp: issuedAt + 5 * 60, // Set expiration time to 5 minutes.
    iat: issuedAt,
    iss: jwtIssuer,
    jti: Math.random().toString()
  }
  const jwtToken = jwt.sign(payload, jwtSecret, { algorithm: 'HS256' })
  core.info('JWT token generated.')
  return jwtToken
}

export async function updateAddon(
  addonGuid: string,
  license: undefined | string,
  uploadUuid: string,
  jwtToken: string,
  approvalNotes: string | undefined,
  releaseNotes: Record<string, string> | undefined
) {
  // https://addons-server.readthedocs.io/en/latest/topics/api/addons.html#version-create
  // https://addons-server.readthedocs.io/en/latest/topics/api/addons.html#version-sources
  core.info('Start to update add-on.')
  const url = `https://addons.mozilla.org/api/v5/addons/addon/${addonGuid}/versions/`
  const body = {
    approval_notes: approvalNotes,
    license,
    release_notes: releaseNotes,
    upload: uploadUuid
  }
  const headers = { Authorization: `jwt ${jwtToken}` }
  await axios.post(url, body, { headers })
  core.info('Add-on updated.')
}

async function waitUntilXpiValidated(uploadUuid: string, jwtToken: string): Promise<void> {
  // https://addons-server.readthedocs.io/en/latest/topics/api/addons.html#upload-detail
  const MAX_WAIT_TIME = 10 * 60 * 1000 // 10 minutes

  const url = `https://addons.mozilla.org/api/v5/addons/upload/${uploadUuid}/`
  const endTime = Date.now() + MAX_WAIT_TIME
  const headers = { Authorization: `jwt ${jwtToken}` }

  while (Date.now() < endTime) {
    core.info('xpi not yet validated. Wait 5 seconds.')
    await new Promise(res => setTimeout(res, 5000))

    core.info('Checking if xpi is validated.')
    const response = await axios<UploadResponse>(url, { headers })

    if (response.data.processed) {
      if (response.data.valid) {
        return
      }

      const validationMsg = stringify(response.data.validation)
      core.setFailed(`xpi processed, but not valid:\n${validationMsg}`)
      process.exit(ERR_XPI_VALIDATION_FAILED)
    }
  }

  process.exit(ERR_XPI_VALIDATION_TIMEOUT)
}

export async function uploadXpi(
  xpiPath: string,
  jwtToken: string,
  selfHosted: boolean
): Promise<string> {
  // https://addons-server.readthedocs.io/en/latest/topics/api/addons.html#upload-create
  const url = 'https://addons.mozilla.org/api/v5/addons/upload/'

  // Send upload request.
  core.info('Start to upload xpi file to firefox addons server.')
  const formData = new FormData()
  formData.append('upload', createReadStream(xpiPath))
  formData.append('channel', selfHosted ? 'unlisted' : 'listed')
  const headers = { ...formData.getHeaders(), Authorization: `jwt ${jwtToken}` }
  const response = await axios.post<UploadResponse>(url, formData, { headers })
  core.info('xpi file uploaded.')

  // Wait until xpi is validated.
  const uploadUuid = response.data.uuid
  await waitUntilXpiValidated(uploadUuid, jwtToken)

  core.info('xpi processed.')
  return uploadUuid
}
