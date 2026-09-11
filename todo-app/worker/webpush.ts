// Web Push with WebCrypto only: VAPID (RFC 8292) identifies this Worker to the
// push service, aes128gcm (RFC 8291) encrypts the payload for the phone. Apple's
// push service (iPhone home-screen apps) speaks the same protocol as the others.
import { base64UrlToBytes, bytesToBase64Url } from '../src/base64url'

/** Where to push, and the phone's keys — straight from the browser's `PushSubscription`. */
export interface PushTarget {
  endpoint: string
  /** The phone's public key: base64url, uncompressed P-256 point (65 bytes). */
  p256dh: string
  /** The phone's auth secret: base64url, 16 bytes. */
  auth: string
}

export interface VapidKeys {
  /** base64url, uncompressed P-256 point: the `applicationServerKey` the app subscribed with. */
  publicKey: string
  /** base64url `d` of the same key pair. */
  privateKey: string
  /** Contact for the push service: an `https:` or `mailto:` URL. */
  subject: string
}

/** `gone`: the subscription no longer exists (expired, or notifications turned off) — forget it. */
export type PushResult = 'ok' | 'gone' | 'error'

const ECDH = { name: 'ECDH', namedCurve: 'P-256' }
const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' }
/** One record holds the whole payload: ours are far below 4 KB. */
const RECORD_SIZE = 4096
const encoder = new TextEncoder()

/** Never throws: one broken subscription must not stop the others from being sent. */
export async function sendPush(
  target: PushTarget,
  payload: unknown,
  vapid: VapidKeys,
  ttlSeconds: number,
): Promise<PushResult> {
  let body: Uint8Array<ArrayBuffer>
  let authorization: string
  try {
    body = await encryptPayload(encoder.encode(JSON.stringify(payload)), target)
    authorization = await vapidAuthorization(target.endpoint, vapid)
  } catch (error) {
    console.error('push not sent: bad subscription keys or VAPID keys', error)
    return 'error'
  }
  let response: Response
  try {
    response = await fetch(target.endpoint, {
      method: 'POST',
      headers: {
        authorization,
        'content-encoding': 'aes128gcm',
        'content-type': 'application/octet-stream',
        ttl: String(Math.max(0, Math.round(ttlSeconds))),
        urgency: 'high',
      },
      body,
    })
  } catch (error) {
    console.error(`push not delivered to ${new URL(target.endpoint).host}: network error`, error)
    return 'error'
  }
  if (response.status === 404 || response.status === 410) return 'gone'
  if (response.ok) return 'ok'
  const host = new URL(target.endpoint).host
  console.error(`push refused by ${host}: ${response.status} ${await response.text().catch(() => '')}`)
  return 'error'
}

/** The `Authorization` header for one push service: a JWT whose audience is that service's origin. */
export async function vapidAuthorization(endpoint: string, vapid: VapidKeys, nowMs = Date.now()): Promise<string> {
  const header = encodeJson({ typ: 'JWT', alg: 'ES256' })
  const claims = encodeJson({
    aud: new URL(endpoint).origin,
    exp: Math.floor(nowMs / 1000) + 12 * 3600,
    sub: vapid.subject,
  })
  const unsigned = `${header}.${claims}`
  const key = await crypto.subtle.importKey('jwk', p256Jwk(vapid.publicKey, vapid.privateKey), ECDSA, false, ['sign'])
  // WebCrypto's ECDSA signature is already JWT's raw r‖s form.
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(unsigned))
  return `vapid t=${unsigned}.${bytesToBase64Url(new Uint8Array(signature))}, k=${vapid.publicKey}`
}

export interface EncryptOptions {
  /** Tests only (RFC 8291's worked example): otherwise a fresh random salt… */
  salt?: Uint8Array<ArrayBuffer>
  /** …and a fresh key pair for every message. Both halves base64url, as in the RFC. */
  localKeys?: { publicKey: string; privateKey: string }
}

/** RFC 8291: the request body for one message, `aes128gcm`-encrypted for the phone's keys. */
export async function encryptPayload(
  plaintext: Uint8Array,
  target: Pick<PushTarget, 'p256dh' | 'auth'>,
  options: EncryptOptions = {},
): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublic = base64UrlToBytes(target.p256dh)
  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(16))
  const local = options.localKeys
    ? {
        privateKey: await crypto.subtle.importKey(
          'jwk',
          p256Jwk(options.localKeys.publicKey, options.localKeys.privateKey),
          ECDH,
          false,
          ['deriveBits'],
        ),
        publicKey: base64UrlToBytes(options.localKeys.publicKey),
      }
    : await ephemeralKeys()

  const uaKey = await crypto.subtle.importKey('raw', uaPublic, ECDH, false, [])
  const ecdh = { name: 'ECDH', public: uaKey }
  const ecdhSecret = await crypto.subtle.deriveBits(ecdh, local.privateKey, 256)

  const keyInfo = concat(encoder.encode('WebPush: info\0'), uaPublic, local.publicKey)
  const ikm = await hkdf(base64UrlToBytes(target.auth), ecdhSecret, keyInfo, 32)
  const cek = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12)

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  // A single record: the payload, then 0x02 — "last record", no padding.
  const record = concat(plaintext, new Uint8Array([2]))
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, record))

  // Header: salt (16) | record size (uint32) | key id length (1) | key id = our public key.
  const header = new Uint8Array(21 + local.publicKey.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, RECORD_SIZE)
  header[20] = local.publicKey.length
  header.set(local.publicKey, 21)
  return concat(header, ciphertext)
}

async function ephemeralKeys(): Promise<{ privateKey: CryptoKey; publicKey: Uint8Array<ArrayBuffer> }> {
  const pair = (await crypto.subtle.generateKey(ECDH, true, ['deriveBits'])) as CryptoKeyPair
  const publicKey = new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer)
  return { privateKey: pair.privateKey, publicKey }
}

/** HKDF-SHA-256 extract-then-expand, as one WebCrypto call. */
async function hkdf(
  salt: Uint8Array,
  ikm: ArrayBuffer | Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8))
}

/** A P-256 key as JWK: x and y come from the uncompressed public point (0x04 ‖ x ‖ y). */
function p256Jwk(publicKey: string, privateKey: string): JsonWebKey {
  const point = base64UrlToBytes(publicKey)
  return {
    kty: 'EC',
    crv: 'P-256',
    x: bytesToBase64Url(point.slice(1, 33)),
    y: bytesToBase64Url(point.slice(33, 65)),
    d: privateKey,
  }
}

function encodeJson(value: unknown): string {
  return bytesToBase64Url(encoder.encode(JSON.stringify(value)))
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}
