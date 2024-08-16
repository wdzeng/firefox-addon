import fs from 'node:fs'

import * as core from '@actions/core'
import AdmZip from 'adm-zip'
import axios from 'axios'
import tmp from 'tmp'

import { handleError } from '@/error'
import { generateJwtToken, updateAddon, uploadXpi } from '@/lib'
import { isGitHubAction } from '@/utils'

const TEST_ADDON = `
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
`

async function getAddonLastUpdate(addonGuid: string, jwtToken: string): Promise<number> {
  // https://mozilla.github.io/addons-server/topics/api/addons.html#get--api-v5-addons-addon-(int-id%7Cstring-slug%7Cstring-guid)-
  const url = `https://addons.mozilla.org/api/v5/addons/addon/${addonGuid}/`
  const headers = { Authorization: `jwt ${jwtToken}` }
  const res = await axios.get<{ last_updated: string }>(url, { headers })
  const lastUpdate = res.data.last_updated // ISO8601
  return new Date(lastUpdate).getTime()
}

function isMainGitHubAction(): boolean {
  return isGitHubAction() && process.env.GITHUB_REF === 'refs/heads/main'
}

function getEnv(): {
  addonGuid: string
  jwtIssuer: string
  jwtSecret: string
} {
  const addonGuid = process.env.TEST_ADDON_GUID
  const jwtIssuer = process.env.TEST_JWT_ISSUER
  const jwtSecret = process.env.TEST_JWT_SECRET
  if (!addonGuid || !jwtIssuer || !jwtSecret) {
    if (isGitHubAction()) {
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

function updateVersionAndSaveZip(zipPath: string, now: Date): void {
  const zip = new AdmZip(zipPath)

  const manifest = zip.getEntry('manifest.json')
  if (!manifest) {
    throw new Error('manifest.json not found in the zip file.')
  }

  // eslint-disable-next-line unicorn/consistent-function-scoping
  const toTwoDigit = (n: number) => n.toString().padStart(2, '0')
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
  const lastUpdate = await getAddonLastUpdate(addonGuid, generateJwtToken(jwtIssuer, jwtSecret))
  const now = new Date()

  // The firefox add-on server has a rate limit, so don't run this test too frequently. If the last
  // update is within 1 hour, skip the test. But in production workflow (main branch) we force to
  // run the test.
  if (!isMainGitHubAction() && now.getTime() < lastUpdate + 60 * 60 * 1000) {
    console.warn(
      `The last update is ${new Date(lastUpdate).toISOString()}. We run the test more than once within an hour, so skip the test.`
    )
    process.exit(1)
  }

  const xpiPath = `${tmp.fileSync().name}.zip`
  fs.writeFileSync(xpiPath, TEST_ADDON, 'base64')
  updateVersionAndSaveZip(xpiPath, now)

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
