import fs from 'node:fs'

import * as core from '@actions/core'

import { ERR_XPI_FILE, handleError } from '@/error'
import { generateJwtToken, updateAddon, uploadXpi } from '@/firefox-addon'

function isStringToStringMapping(a: unknown): a is Record<string, string> {
  if (typeof a !== 'object' || a === null) {
    return false
  }
  for (const [k, v] of Object.entries(a)) {
    if (typeof k !== 'string' || typeof v !== 'string') {
      return false
    }
  }
  return true
}

function requireXpiFileExists(path: string): void {
  try {
    const s = fs.statSync(path)
    if (!s.isFile()) {
      core.setFailed(`Not a regular file: ${path}`)
      process.exit(ERR_XPI_FILE)
    }
    core.debug('The xpi file exists and is a regular file.')
  } catch {
    core.setFailed(`File not found: ${path}`)
    process.exit(ERR_XPI_FILE)
  }
}

function isValidXpiExtensionName(xpiPath: string) {
  const ext = xpiPath.split('.').at(-1)
  return ext === 'zip' || ext === 'xpi' || ext === 'crx'
}

async function run(
  addonGuid: string,
  license: string | undefined,
  xpiPath: string,
  selfHosted: boolean,
  jwtIssuer: string,
  jwtSecret: string,
  approvalNotes: string | undefined,
  releaseNotes: Record<string, string> | undefined
) {
  core.info('Start to publish add-on.')
  const jwtToken = generateJwtToken(jwtIssuer, jwtSecret)
  const uuid = await uploadXpi(xpiPath, jwtToken, selfHosted)
  await updateAddon(addonGuid, license, uuid, jwtToken, approvalNotes, releaseNotes)
  core.info('Add-on published.')
}

async function main() {
  const addonGuid = core.getInput('addon-guid', { required: true })
  const xpiPath = core.getInput('xpi-path', { required: true })
  if (!isValidXpiExtensionName(xpiPath)) {
    core.setFailed('Input "xpi-path" must have a valid extension name (.zip, .xpi, .crx).')
    core.debug(`xpi-path: ${xpiPath}`)
    return
  }
  requireXpiFileExists(xpiPath)

  const license = core.getInput('license', { required: false }) || undefined
  let releaseNotes: Record<string, string> | undefined = undefined
  const releaseNotesInput = core.getInput('release-notes', { required: false }) || undefined
  if (releaseNotesInput) {
    try {
      releaseNotes = JSON.parse(releaseNotesInput) as Record<string, string>
    } catch {
      core.setFailed('Input "release-notes" is not a valid JSON string.')
      core.debug(`release-notes: ${releaseNotesInput}`)
      return
    }
    if (!isStringToStringMapping(releaseNotes)) {
      core.setFailed('Input "release-notes" is not a string-to-string mapping.')
      core.debug(`release-notes: ${releaseNotesInput}`)
      return
    }
  }
  const approvalNotes = core.getInput('approval-notes', { required: false }) || undefined
  const selfHosted = core.getBooleanInput('self-hosted')
  const jwtIssuer = core.getInput('jwt-issuer', { required: true })
  const jwtSecret = core.getInput('jwt-secret', { required: true })

  try {
    await run(
      addonGuid,
      license,
      xpiPath,
      selfHosted,
      jwtIssuer,
      jwtSecret,
      approvalNotes,
      releaseNotes
    )
  } catch (e: unknown) {
    handleError(e)
  }
}

// Cannot use top-level await in the transpiled .cjs file.
void main()
