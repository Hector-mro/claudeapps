// Generates a VAPID key pair for push notifications (see worker/webpush.ts).
//
//   node scripts/vapid-keys.mjs
//
// VAPID_PUBLIC_KEY goes in wrangler.jsonc and, as VITE_VAPID_PUBLIC_KEY, in
// .env.production. VAPID_PRIVATE_KEY only goes in the Worker secret:
//   npx wrangler secret put VAPID_PRIVATE_KEY
// For local dev, put both in .dev.vars and the public one in .env.development.
// A new pair invalidates every phone's subscription: they must turn
// notifications on again.
const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
])
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', publicKey))
const { d } = await crypto.subtle.exportKey('jwk', privateKey)

console.log(`VAPID_PUBLIC_KEY=${Buffer.from(raw).toString('base64url')}`)
console.log(`VAPID_PRIVATE_KEY=${d}`)
