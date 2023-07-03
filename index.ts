import { createReadStream, promises as fs } from 'fs'
import * as core from '@actions/core'
import jwt from 'jsonwebtoken'
import FormData from 'form-data'
import axios, { AxiosError } from 'axios'

function handleError(error: unknown) {
  core.debug(JSON.stringify(error))

  // HTTP error
  if (error instanceof AxiosError) {
    if (error.response) {
      // Got response from Firefox API server with status code 4XX or 5XX
      core.setFailed('Firefox API server responses with error code: ' + error.response.status)
      core.setFailed(error.response.data)
    }
    core.setFailed(error.message)
    return
  }

  // Unknown error
  if (error instanceof Error) {
    core.setFailed(error)
  }
  core.setFailed('Unknown error occurred.')
}

function generateJwtToken(jwtIssuer: string, jwtSecret: string): string {
  // https://addons-server.readthedocs.io/en/latest/topics/api/auth.html#create-a-jwt-for-each-request

  core.info('Start to generate JWT token.')
  const issuedAt = Math.floor(Date.now() / 1000)
  const payload = {
    iss: jwtIssuer,
    jti: Math.random().toString(),
    iat: issuedAt,
    exp: issuedAt + 5 * 60  // set expiration time to 5 minutes
  }
  const jwtToken = jwt.sign(payload, jwtSecret, { algorithm: 'HS256' })
  core.info('JWT token generated.')
  core.debug('JWT token: ' + jwtToken)
  return jwtToken
}

async function requireFileExists(path: string) {
  try {
    const s = await fs.stat(path)
    if (!s.isFile) {
      core.setFailed('Not a regular file: ' + path)
      process.exit(1)
    }
    core.debug('The xpi file exists and is a regular file.')
  } catch (e: unknown) {
    core.setFailed('File not found: ' + path)
    process.exit(1)
  }
}

async function updateAddon(addonGuid: string, license: undefined | string, uploadUuid: string, jwtToken: string) {
  // https://addons-server.readthedocs.io/en/latest/topics/api/addons.html#version-create
  // https://addons-server.readthedocs.io/en/latest/topics/api/addons.html#version-sources

  core.info('Start to update add-on.')

  const url = `https://addons.mozilla.org/api/v5/addons/addon/${addonGuid}/versions/`
  const body = { upload: uploadUuid, license }
  const headers = { Authorization: `jwt ${jwtToken}` }
  await axios.post(url, body, { headers })

  core.info('Add-on updated.')
}

async function uploadXpi(xpiPath: string, jwtToken: string, selfHosted: boolean): Promise<string> {
  // https://addons-server.readthedocs.io/en/latest/topics/api/addons.html#upload-create

  // send upload create
  core.info('Start to upload xpi file to firefox addons server.')

  await requireFileExists(xpiPath)

  let url = 'https://addons.mozilla.org/api/v5/addons/upload/'
  const formData = new FormData()
  formData.append('upload', createReadStream(xpiPath))
  formData.append('channel', selfHosted ? 'unlisted' : 'listed')
  let headers = { ...formData.getHeaders(), Authorization: `jwt ${jwtToken}` }
  let response = await axios.post(url, formData, { headers })

  core.info('xpi file uploaded.')

  const uuid: string = response.data.uuid
  let processed: boolean = response.data.processed

  // Wait for upload completed
  url = `https://addons.mozilla.org/api/v5/addons/upload/${uuid}/`
  headers = { Authorization: `jwt ${jwtToken}` }
  while (!processed) {
    core.info('xpi not yet processed. Wait 5s.')
    await new Promise(res => setTimeout(res, 5000))

    core.info('Checking if xpi is processed.')
    response = await axios(url, { headers })
    processed = response.data.processed
  }

  if (!response.data.valid) {
    // Field `validation` is an object. Convert it to string for better display.
    const validationMsg = JSON.stringify(response.data.validation, null, 2)
    core.setFailed(`xpi processed, but not valid:\n${validationMsg}`)
  }

  core.info('xpi processed.')
  return uuid
}

async function run(addonGuid: string, license: string | undefined, xpiPath: string, selfHosted: boolean, jwtIssuer: string, jwtSecret: string) {
  core.info('Start to publish add-on.')

  // Create jwt token
  const jwtToken = generateJwtToken(jwtIssuer, jwtSecret)

  // Upload xpi
  const uuid = await uploadXpi(xpiPath, jwtToken, selfHosted)

  // Update existing add-on
  await updateAddon(addonGuid, license, uuid, jwtToken)

  core.info('Add-on published.')
}

async function main() {
  const addonGuid = core.getInput('addon-guid', { required: true })
  const xpiPath = core.getInput('xpi-path', { required: true })
  const license = core.getInput('license', { required: false }) || undefined
  const selfHosted = core.getBooleanInput('self-hosted')
  const jwtIssuer = core.getInput('jwt-issuer', { required: true })
  const jwtSecret = core.getInput('jwt-secret', { required: true })

  core.debug('Addon GUID: ' + addonGuid)
  core.debug('Xpi file path: ' + xpiPath)
  core.debug('License: ' + license)
  core.debug('Self hosted: ' + selfHosted)
  core.debug('JWT issuer: ' + jwtIssuer)
  core.debug('JWT secret: ' + jwtSecret)

  try {
    await run(addonGuid, license, xpiPath, selfHosted, jwtIssuer, jwtSecret)
  } catch (e: unknown) {
    handleError(e)
  }
}

main()
