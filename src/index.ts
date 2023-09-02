import * as core from '@actions/core'

import { handleError } from '@/error'
import { generateJwtToken, updateAddon, uploadXpi } from '@/firefox-addon-utils'

async function run(
  addonGuid: string,
  license: string | undefined,
  xpiPath: string,
  selfHosted: boolean,
  jwtIssuer: string,
  jwtSecret: string
) {
  core.info('Start to publish add-on.')
  const jwtToken = generateJwtToken(jwtIssuer, jwtSecret)
  const uuid = await uploadXpi(xpiPath, jwtToken, selfHosted)
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

  try {
    await run(addonGuid, license, xpiPath, selfHosted, jwtIssuer, jwtSecret)
  } catch (e: unknown) {
    handleError(e)
  }
}

// Cannot use top-level await in the transpiled .cjs file.
void main()
