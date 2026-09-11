// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { base64UrlToBytes, bytesToBase64Url } from '../src/base64url'
import { encryptPayload, vapidAuthorization } from './webpush'

/** RFC 8291, Appendix A: the worked example, byte for byte. */
const RFC = {
  plaintext: 'V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  header: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  ciphertext: '8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ',
}

const HEADER_LENGTH = 86

describe('encryptPayload', () => {
  it('matches the RFC 8291 example', async () => {
    const body = await encryptPayload(
      base64UrlToBytes(RFC.plaintext),
      { p256dh: RFC.uaPublic, auth: RFC.auth },
      { salt: base64UrlToBytes(RFC.salt), localKeys: { publicKey: RFC.asPublic, privateKey: RFC.asPrivate } },
    )

    expect([...body.slice(0, HEADER_LENGTH)]).toEqual([...base64UrlToBytes(RFC.header)])
    expect(bytesToBase64Url(body.slice(HEADER_LENGTH))).toBe(RFC.ciphertext)
  })

  it('uses a fresh salt and key pair for every message', async () => {
    const plaintext = new TextEncoder().encode('Payer le loyer')
    const target = { p256dh: RFC.uaPublic, auth: RFC.auth }
    const [a, b] = await Promise.all([encryptPayload(plaintext, target), encryptPayload(plaintext, target)])

    // salt (16) + record size (4) + key id length (1) + key id (65), then payload + delimiter + GCM tag.
    expect(a.length).toBe(HEADER_LENGTH + plaintext.length + 1 + 16)
    expect(new DataView(a.buffer).getUint32(16)).toBe(4096)
    expect(a[20]).toBe(65)
    expect(bytesToBase64Url(a.slice(0, HEADER_LENGTH))).not.toBe(bytesToBase64Url(b.slice(0, HEADER_LENGTH)))
  })
})

describe('vapidAuthorization', () => {
  it('signs a token for the push service origin that verifies with the public key', async () => {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair
    const publicKey = bytesToBase64Url(new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer))
    const { d } = (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey
    const vapid = { publicKey, privateKey: d ?? '', subject: 'https://example.com/app/' }

    const value = await vapidAuthorization('https://web.push.apple.com/QGh1bmdyeQ', vapid, 1_800_000_000_000)

    const match = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(value)
    expect(match).not.toBeNull()
    const [, header, claims, signature, k] = match!
    expect(k).toBe(publicKey)
    const decode = (part: string) => JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)))
    expect(decode(header)).toEqual({ typ: 'JWT', alg: 'ES256' })
    expect(decode(claims)).toEqual({
      aud: 'https://web.push.apple.com',
      exp: 1_800_000_000 + 12 * 3600,
      sub: 'https://example.com/app/',
    })
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pair.publicKey,
      base64UrlToBytes(signature),
      new TextEncoder().encode(`${header}.${claims}`),
    )
    expect(valid).toBe(true)
  })
})
