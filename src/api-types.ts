// https://addons-server.readthedocs.io/en/latest/topics/api/addons.html#upload-detail
export interface UploadResponse {
  // The upload id.
  uuid: string
  // The version channel, which determines its visibility on the site. Can be either unlisted or listed.
  channel: 'listed' | 'unlisted'
  // If the version has been processed by the validator.
  processed: boolean
  // If this upload has been submitted as a new add-on or version already. An upload can only be submitted once.
  submitted: boolean
  // URL to check the status of this upload.
  url: string
  // If the version passed validation.
  valid: boolean
  // The validation results JSON blob.
  validation: object
  // The version number parsed from the manifest.
  version: string
}

// https://mozilla.github.io/addons-server/topics/api/addons.html#version-compatibility-examples
export type Compatibility = string[] | Record<string, { min?: string; max?: string }>
