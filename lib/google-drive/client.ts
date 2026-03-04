/**
 * Google Drive API client — server-side only.
 *
 * Credentials are sourced exclusively from environment variables.
 * The Drive scope is read-only (drive.readonly) — least privilege.
 * Never import or call this file from any client-side code.
 */

import { google } from 'googleapis'

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

function getServiceAccountCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) {
    throw new Error(
      'Missing GOOGLE_SERVICE_ACCOUNT_JSON environment variable. ' +
      'Set it to the base64-encoded service account JSON.'
    )
  }

  let decoded: string
  try {
    decoded = Buffer.from(raw, 'base64').toString('utf-8')
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid base64.')
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(decoded)
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON decoded value is not valid JSON.')
  }

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(
      'Service account JSON must contain client_email and private_key fields.'
    )
  }

  return parsed
}

/**
 * Returns an authenticated Google Drive v3 client using a service account.
 * Credentials are never exposed to the browser.
 */
export function getDriveClient() {
  const credentials = getServiceAccountCredentials()

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: SCOPES,
  })

  return google.drive({ version: 'v3', auth })
}

/**
 * The Drive folder ID to monitor — read from environment variables only.
 */
export function getDriveFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_FOLDER_ID
  if (!id) {
    throw new Error('Missing GOOGLE_DRIVE_FOLDER_ID environment variable.')
  }
  return id
}
