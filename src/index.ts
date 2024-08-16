import fs from 'node:fs'

import * as core from '@actions/core'

import { ERR_INVALID_INPUT, ERR_XPI_FILE, handleError } from '@/error'
import { generateJwtToken, updateAddon, uploadXpi } from '@/firefox-addon'
import { isStringToStringMapping } from '@/utils'

function parseReleaseNotes(): undefined | Record<string, string> {
  const releaseNotesInput = core.getInput('release-notes', { required: false })

  if (!releaseNotesInput) {
    return undefined
  }

  let ret: unknown
  try {
    ret = JSON.parse(releaseNotesInput)
  } catch {
    core.setFailed('Input "release-notes" is not a valid JSON string.')
    core.debug(`release-notes: ${releaseNotesInput}`)
    process.exit(ERR_INVALID_INPUT)
  }

  if (!isStringToStringMapping(ret)) {
    core.setFailed('Input "release-notes" is not a string-to-string mapping.')
    core.debug(`release-notes: ${releaseNotesInput}`)
    process.exit(ERR_INVALID_INPUT)
  }

  return ret
}

function requireXpiFileExists(xpiPath: string): void {
  try {
    const s = fs.statSync(xpiPath)
    if (!s.isFile()) {
      core.setFailed(`Not a regular file: ${xpiPath}`)
      process.exit(ERR_XPI_FILE)
    }
    core.debug('The xpi file exists and is a regular file.')
  } catch {
    core.setFailed(`File not found: ${xpiPath}`)
    process.exit(ERR_XPI_FILE)
  }
}

function requireValidXpiExtensionName(xpiPath: string) {
  const ext = xpiPath.split('.').at(-1)
  if (!ext || !['zip', 'xpi', 'crx'].includes(ext)) {
    core.setFailed('Input "xpi-path" must have a valid extension name (.zip, .xpi, .crx).')
    core.debug(`xpi-path: ${xpiPath}`)
    process.exit(ERR_XPI_FILE)
  }
}

function requireValidSourceFileExtensionName(f: string) {
  if (f.endsWith('.zip') || f.endsWith('.tar.gz') || f.endsWith('.tgz') || f.endsWith('.tar.bz2')) {
    return
  }
  core.setFailed(
    'Input "source-file-path" must have a valid extension name (.zip, .tar.gz, .tgz, .tar.bz2).'
  )
  core.debug(`source-file-path: ${f}`)
  process.exit(ERR_INVALID_INPUT)
}

async function run(
  addonGuid: string,
  license: string | undefined,
  xpiPath: string,
  selfHosted: boolean,
  jwtIssuer: string,
  jwtSecret: string,
  approvalNotes: string | undefined,
  releaseNotes: Record<string, string> | undefined,
  sourceFilePath: string | undefined
) {
  core.info('Start to publish add-on.')
  const jwtToken = generateJwtToken(jwtIssuer, jwtSecret)
  const uuid = await uploadXpi(xpiPath, jwtToken, selfHosted)
  await updateAddon(
    addonGuid,
    license,
    uuid,
    jwtToken,
    approvalNotes,
    releaseNotes,
    sourceFilePath,
    xpiPath
  )
  core.info('Add-on published.')
}

async function main() {
  const addonGuid = core.getInput('addon-guid', { required: true })
  const xpiPath = core.getInput('xpi-path', { required: true })
  requireValidXpiExtensionName(xpiPath)
  requireXpiFileExists(xpiPath)

  const license = core.getInput('license', { required: false }) || undefined
  const releaseNotes = parseReleaseNotes()
  const approvalNotes = core.getInput('approval-notes', { required: false }) || undefined
  const selfHosted = core.getBooleanInput('self-hosted')
  const jwtIssuer = core.getInput('jwt-issuer', { required: true })
  const jwtSecret = core.getInput('jwt-secret', { required: true })
  const sourceFilePath = core.getInput('source-file-path', { required: false }) || undefined
  if (sourceFilePath) {
    requireValidSourceFileExtensionName(sourceFilePath)
  }

  try {
    await run(
      addonGuid,
      license,
      xpiPath,
      selfHosted,
      jwtIssuer,
      jwtSecret,
      approvalNotes,
      releaseNotes,
      sourceFilePath
    )
  } catch (e: unknown) {
    handleError(e)
  }
}

// Cannot use top-level await in the transpiled .cjs file.
void main()
