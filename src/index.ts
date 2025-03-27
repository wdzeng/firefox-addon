import * as core from '@actions/core'

import { handleError } from '@/error'
import { generateJwtToken, updateAddon, uploadXpi } from '@/lib'
import {
  logger,
  requireValidSourceFileExtensionName,
  requireValidXpiFileExtensionName,
  tryResolveFile,
  validateAndParseCompatibilityInput,
  validateAndParseReleaseNotesInput
} from '@/utils'

import type { Compatibility } from '@/api-types'

async function run(
  addonGuid: string,
  license: string | undefined,
  xpiPath: string,
  selfHosted: boolean,
  jwtIssuer: string,
  jwtSecret: string,
  approvalNotes: string | undefined,
  compatibility: Compatibility | undefined,
  releaseNotes: Record<string, string> | undefined,
  sourceFilePath: string | undefined
) {
  logger.info('Start to publish add-on.')
  const jwtToken = generateJwtToken(jwtIssuer, jwtSecret)
  const uuid = await uploadXpi(xpiPath, jwtToken, selfHosted)
  await updateAddon(
    addonGuid,
    license,
    uuid,
    jwtToken,
    approvalNotes,
    compatibility,
    releaseNotes,
    sourceFilePath,
    xpiPath
  )
  logger.info('Add-on published.')
}

async function main() {
  const addonGuid = core.getInput('addon-guid', { required: true })
  const jwtIssuer = core.getInput('jwt-issuer', { required: true })
  const jwtSecret = core.getInput('jwt-secret', { required: true })
  let xpiPath = core.getInput('xpi-path', { required: true })
  const approvalNotes = core.getInput('approval-notes', { required: false }) || undefined
  const compatibilityInput = core.getInput('compatibility', { required: false }) || undefined
  const license = core.getInput('license', { required: false }) || undefined
  const releaseNotesInput = core.getInput('release-notes', { required: false }) || undefined
  const selfHosted = core.getBooleanInput('self-hosted')
  let sourceFilePath = core.getInput('source-file-path', { required: false }) || undefined

  try {
    xpiPath = tryResolveFile(xpiPath)
    requireValidXpiFileExtensionName(xpiPath)

    const releaseNotes = validateAndParseReleaseNotesInput(releaseNotesInput)
    if (sourceFilePath) {
      sourceFilePath = tryResolveFile(sourceFilePath)
      requireValidSourceFileExtensionName(sourceFilePath)
    }

    const compatibility = validateAndParseCompatibilityInput(compatibilityInput)

    await run(
      addonGuid,
      license,
      xpiPath,
      selfHosted,
      jwtIssuer,
      jwtSecret,
      approvalNotes,
      compatibility,
      releaseNotes,
      sourceFilePath
    )
  } catch (e: unknown) {
    handleError(e)
  }
}

// Cannot use top-level await in the transpiled .cjs file.
void main()
