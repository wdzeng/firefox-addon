import fs from 'node:fs'

import * as core from '@actions/core'
import AdmZip from 'adm-zip'
import tmp from 'tmp'

import { handleError } from '@/error'
import { generateJwtToken, updateAddon, uploadXpi } from '@/firefox-addon'

const TEST_ADDON = `
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
`

function getEnv(): {
  addonGuid: string
  jwtIssuer: string
  jwtSecret: string
} {
  const addonGuid = process.env.TEST_ADDON_GUID
  const jwtIssuer = process.env.TEST_JWT_ISSUER
  const jwtSecret = process.env.TEST_JWT_SECRET
  if (!addonGuid || !jwtIssuer || !jwtSecret) {
    if (process.env.GITHUB_ACTIONS) {
      core.setFailed(
        'Environment variables TEST_ADDON_GUID, TEST_JWT_ISSUER and TEST_JWT_SECRET are required. Did you set the secrets?'
      )
      process.exit(1)
    }

    throw new Error(
      'Environment variables TEST_ADDON_GUID, TEST_JWT_ISSUER and TEST_JWT_SECRET are required. Did you have a .env.local file?'
    )
  }
  return { addonGuid, jwtIssuer, jwtSecret }
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

  // @ts-expect-error: JSON.parse accepts buffer.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const data: { version: string } = JSON.parse(manifest.getData())
  data.version = version
  manifest.setData(JSON.stringify(data))

  zip.writeZip()
  core.info(`Updated version to ${version} at ${zipPath}`)
}

async function main() {
  const { addonGuid, jwtIssuer, jwtSecret } = getEnv()
  const xpiPath = `${tmp.fileSync().name}.zip`
  fs.writeFileSync(xpiPath, TEST_ADDON, 'base64')
  updateVersionAndSaveZip(xpiPath)

  const license = 'MIT'
  const selfHosted = true

  try {
    const jwtToken = generateJwtToken(jwtIssuer, jwtSecret)
    const uuid = await uploadXpi(xpiPath, jwtToken, selfHosted)
    const approvalNotes = 'general update'
    const releaseNotes = { 'zh-TW': 'improve performance' }
    await updateAddon(
      addonGuid,
      license,
      uuid,
      jwtToken,
      approvalNotes,
      releaseNotes,
      xpiPath, // Let the source code file be the same as the xpi file in this test.
      xpiPath
    )
  } catch (e: unknown) {
    // The test will exit with non-zero code.
    handleError(e)
  }
}

// Cannot use top-level await in the transpiled .cjs file.
void main()
