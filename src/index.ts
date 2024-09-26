import fs from 'node:fs'
import { globSync } from 'glob'

import * as core from '@actions/core'

import { ERR_INVALID_INPUT, FirefoxAddonActionError, handleError } from '@/error'
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
    core.debug(`release-notes: ${releaseNotesInput}`)
    throw new FirefoxAddonActionError(
      'Input "release-notes" is not a valid JSON string.',
      ERR_INVALID_INPUT
    )
  }

  if (!isStringToStringMapping(ret)) {
    core.debug(`release-notes: ${releaseNotesInput}`)
    throw new FirefoxAddonActionError(
      'Input "release-notes" is not a string-to-string mapping.',
      ERR_INVALID_INPUT
    )
  }

  return ret
}

function tryResolveFile(pattern: string): string {
  const foundFiles = globSync(pattern)

  if (foundFiles.length < 1)
    throw new FirefoxAddonActionError(`File not found: ${pattern}`, ERR_INVALID_INPUT)
  if (foundFiles.length > 1)
    throw new FirefoxAddonActionError(`Multiple files found: ${pattern}`, ERR_INVALID_INPUT)

  const stat = fs.statSync(foundFiles[0])

  if (!stat.isFile())
    throw new FirefoxAddonActionError(`Not a regular file: ${pattern}`, ERR_INVALID_INPUT)

  return foundFiles[0];
}

function requireValidXpiExtensionName(xpiPath: string) {
  const ext = xpiPath.split('.').at(-1)
  if (!ext || !['zip', 'xpi', 'crx'].includes(ext)) {
    throw new FirefoxAddonActionError(
      'Input "xpi-path" must have a valid extension name (.zip, .xpi, .crx).',
      ERR_INVALID_INPUT
    )
  }
}

function requireValidSourceFileExtensionName(f: string) {
  if (f.endsWith('.zip') || f.endsWith('.tar.gz') || f.endsWith('.tgz') || f.endsWith('.tar.bz2')) {
    return
  }
  throw new FirefoxAddonActionError(
    'Input "source-file-path" must have a valid extension name (.zip, .tar.gz, .tgz, .tar.bz2).',
    ERR_INVALID_INPUT
  )
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
  const xpiPath = tryResolveFile(core.getInput('xpi-path', { required: true }))
  requireValidXpiExtensionName(xpiPath)

  const license = core.getInput('license', { required: false }) || undefined
  const releaseNotes = parseReleaseNotes()
  const approvalNotes = core.getInput('approval-notes', { required: false }) || undefined
  const selfHosted = core.getBooleanInput('self-hosted')
  const jwtIssuer = core.getInput('jwt-issuer', { required: true })
  const jwtSecret = core.getInput('jwt-secret', { required: true })
  let sourceFilePath = core.getInput('source-file-path', { required: false }) || undefined
  if (sourceFilePath) {
    requireValidSourceFileExtensionName(sourceFilePath)
    sourceFilePath = tryResolveFile(sourceFilePath)
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
