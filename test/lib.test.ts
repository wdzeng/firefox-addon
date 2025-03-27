import fs from 'node:fs'

import axios from 'axios'
import AxiosMockAdapter from 'axios-mock-adapter'
import { File } from 'formdata-node'
import jwt from 'jsonwebtoken'
import tmp from 'tmp'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { ERR_XPI_VALIDATION_TIMEOUT, FirefoxAddonActionError } from '@/error'
import { generateJwtToken, uploadXpi } from '@/lib'

import type { FormData } from 'formdata-node'

import type { UploadResponse } from '@/api-types'

test('generateJwtToken', () => {
  vi.useFakeTimers()
  vi.setSystemTime(42000)

  const jwtIssuer = 'test-jwt-issuer'
  const jwtSecret = 'test-jwt-secret'
  const token = generateJwtToken(jwtIssuer, jwtSecret)
  const decoded = jwt.verify(token, jwtSecret, { issuer: jwtIssuer }) as jwt.JwtPayload

  expect(decoded.iat).toBe(42)
  expect(decoded.exp).toBe(342)
  expect(decoded.iss).toBe('test-jwt-issuer')
  expect(decoded.jti).toBeDefined()

  vi.useRealTimers()
})

describe('uploadXpi', () => {
  let mockAdapter: AxiosMockAdapter

  beforeEach(() => {
    vi.useFakeTimers().setSystemTime(0)
    mockAdapter = new AxiosMockAdapter(axios)
  })

  afterEach(() => {
    mockAdapter.restore()
    vi.useRealTimers()
  })

  test('happy path', async () => {
    let hasUpload = false
    let hasValidated = false

    mockAdapter
      .onPost('https://addons.mozilla.org/api/v5/addons/upload/', undefined, {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        headers: expect.objectContaining({
          'Authorization': 'jwt test-jwt-token',
          'Content-Type': 'multipart/form-data'
        })
      })
      .replyOnce(async config => {
        expect(hasUpload).toBe(false)

        const formData = config.data as FormData

        expect(formData.getAll('upload')).toHaveLength(1)
        expect(formData.get('upload')).toBeInstanceOf(File)

        const upload = formData.get('upload') as File

        await expect(upload.text()).resolves.toBe('test-xpi-content')
        expect(formData.getAll('channel')).toStrictEqual(['unlisted'])

        hasUpload = true
        return [
          201,
          {
            channel: 'unlisted',
            processed: false,
            submitted: false,
            url: 'https://addons.mozilla.org/api/v5/addons/upload/test-upload-uuid/',
            uuid: 'test-upload-uuid',
            valid: false,
            validation: {},
            version: '1.0'
          } satisfies UploadResponse
        ]
      })

    mockAdapter
      .onGet('https://addons.mozilla.org/api/v5/addons/upload/test-upload-uuid/', {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        headers: expect.objectContaining({
          Authorization: 'jwt test-jwt-token'
        })
      })
      .reply(_ => {
        expect(hasUpload).toBe(true)
        expect(hasValidated).toBe(false)

        // TODO: better approach: return not yet validated before 9 minutes; this allows us to also
        // check the timeout settings. But I don't know how to accomplish this using vitest.
        hasValidated = true
        return [
          200,
          {
            channel: 'unlisted',
            processed: true,
            submitted: false,
            url: 'https://addons.mozilla.org/api/v5/addons/upload/test-upload-uuid/',
            uuid: 'test-upload-uuid',
            valid: true,
            validation: {},
            version: '1.0'
          } satisfies UploadResponse
        ]
      })

    const xpiPath = `${tmp.tmpNameSync()}.xpi`
    fs.writeFileSync(xpiPath, 'test-xpi-content')

    const uploadUuidPromise = uploadXpi(xpiPath, 'test-jwt-token', true)
    await vi.waitUntil(() => hasUpload)
    vi.advanceTimersByTime(15 * 1000)

    await expect(uploadUuidPromise).resolves.toBe('test-upload-uuid')
    expect(hasUpload).toBe(true)
    expect(hasValidated).toBe(true)
  })

  test('fail to create upload', async () => {
    mockAdapter
      .onPost('https://addons.mozilla.org/api/v5/addons/upload/', undefined, {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        headers: expect.objectContaining({
          'Authorization': 'jwt test-jwt-token',
          'Content-Type': 'multipart/form-data'
        })
      })
      .reply(500)

    const xpiPath = `${tmp.tmpNameSync()}.xpi`
    fs.writeFileSync(xpiPath, 'test-xpi-content')
    const uploadUuidPromise = uploadXpi(xpiPath, 'test-jwt-token', true)

    await expect(uploadUuidPromise).rejects.toThrow()
  })

  test('timeout exceeds', async () => {
    let hasUpload = false

    mockAdapter
      .onPost('https://addons.mozilla.org/api/v5/addons/upload/', undefined, {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        headers: expect.objectContaining({
          'Authorization': 'jwt test-jwt-token',
          'Content-Type': 'multipart/form-data'
        })
      })
      .replyOnce(async config => {
        expect(hasUpload).toBe(false)

        const formData = config.data as FormData

        expect(formData.getAll('upload')).toHaveLength(1)
        expect(formData.get('upload')).toBeInstanceOf(File)

        const upload = formData.get('upload') as File

        await expect(upload.text()).resolves.toBe('test-xpi-content')
        expect(formData.getAll('channel')).toStrictEqual(['unlisted'])

        hasUpload = true
        return [
          201,
          {
            channel: 'unlisted',
            processed: false,
            submitted: false,
            url: 'https://addons.mozilla.org/api/v5/addons/upload/test-upload-uuid/',
            uuid: 'test-upload-uuid',
            valid: false,
            validation: {},
            version: '1.0'
          } satisfies UploadResponse
        ]
      })

    mockAdapter
      .onGet('https://addons.mozilla.org/api/v5/addons/upload/test-upload-uuid/', {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        headers: expect.objectContaining({
          Authorization: 'jwt test-jwt-token'
        })
      })
      .reply(_ => {
        expect(hasUpload).toBe(true)

        return [
          200,
          {
            channel: 'unlisted',
            processed: false,
            submitted: false,
            url: 'https://addons.mozilla.org/api/v5/addons/upload/test-upload-uuid/',
            uuid: 'test-upload-uuid',
            valid: false,
            validation: {},
            version: '1.0'
          } satisfies UploadResponse
        ]
      })

    const xpiPath = `${tmp.tmpNameSync()}.xpi`
    fs.writeFileSync(xpiPath, 'test-xpi-content')

    const uploadUuidPromise = uploadXpi(xpiPath, 'test-jwt-token', true)
    await vi.waitUntil(() => hasUpload)
    vi.advanceTimersByTime(60 * 1000 * 10)
    try {
      await uploadUuidPromise
    } catch (e) {
      expect(e).toBeInstanceOf(FirefoxAddonActionError)
      expect(e).toHaveProperty('code', ERR_XPI_VALIDATION_TIMEOUT)
    }

    expect(hasUpload).toBe(true)
  })
})
