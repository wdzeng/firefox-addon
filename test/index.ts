import fs from 'node:fs'

import * as core from '@actions/core'
import AdmZip from 'adm-zip'
import tmp from 'tmp'

import { handleError } from '@/error'
import { generateJwtToken, updateAddon, uploadXpi } from '@/firefox-addon'

function requireEnvironmentVariable(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Environment variable ${key} is required.`)
  }
  return value
}

function updateVersionAndSaveZip(zipPath: string): void {
  const zip = new AdmZip(zipPath)

  const manifest = zip.getEntry('manifest.json')
  if (!manifest) {
    throw new Error('manifest.json not found in the zip file.')
  }

  // eslint-disable-next-line unicorn/consistent-function-scoping
  const toTwoDigit = (n: number) => n.toString().padStart(2, '0')
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const date = now.getDate()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const seconds = now.getSeconds()
  const version = `${year.toString().slice(-2)}.${month}${toTwoDigit(date)}.${hour}${toTwoDigit(minute)}.${seconds}`
  core.debug(`Set version to ${version}`)

  // @ts-expect-error: JSON.parse accepts buffer.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const data: { version: string } = JSON.parse(manifest.getData())
  data.version = version
  manifest.setData(JSON.stringify(data))

  zip.writeZip()
}

async function main() {
  const addonGuid = requireEnvironmentVariable('TEST_ADDON_GUID')
  const jwtIssuer = requireEnvironmentVariable('TEST_JWT_ISSUER')
  const jwtSecret = requireEnvironmentVariable('TEST_JWT_SECRET')

  const sourceXpiPath = 'test/test-addon.zip'
  const xpiPath = `${tmp.fileSync().name}.zip`
  core.debug(`Copy test xpi file to temporary path: ${xpiPath}`)
  fs.copyFileSync(sourceXpiPath, xpiPath)
  updateVersionAndSaveZip(xpiPath)

  const license = 'MIT'
  const selfHosted = true

  try {
    const jwtToken = generateJwtToken(jwtIssuer, jwtSecret)
    const uuid = await uploadXpi(xpiPath, jwtToken, selfHosted)
    const approvalNotes = 'general update'
    const releaseNotes = { 'zh-TW': 'improve performance' }
    await updateAddon(addonGuid, license, uuid, jwtToken, approvalNotes, releaseNotes)
  } catch (e: unknown) {
    // The test will exit with non-zero code.
    handleError(e)
  }
}

// Cannot use top-level await in the transpiled .cjs file.
void main()
