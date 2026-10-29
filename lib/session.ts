// Admin session: an HMAC-signed expiry timestamp in a cookie. Web Crypto only, so it runs in the proxy too.

export const SESSION_COOKIE = 'reform_admin'
export const SESSION_TTL_SECONDS = 12 * 60 * 60

const encoder = new TextEncoder()

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function createSession(secret: string, now = Date.now()): Promise<string> {
  const payload = String(Math.floor(now / 1000) + SESSION_TTL_SECONDS)
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(payload))
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`
}

export async function verifySession(token: string | undefined, secret: string, now = Date.now()): Promise<boolean> {
  if (!token) return false
  const [payload, signature, ...rest] = token.split('.')
  if (rest.length || !/^\d{1,12}$/.test(payload ?? '')) return false
  const bytes = fromBase64Url(signature ?? '')
  if (!bytes) return false
  // subtle.verify compares in constant time.
  const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), bytes, encoder.encode(payload))
  return valid && Number(payload) * 1000 > now
}
