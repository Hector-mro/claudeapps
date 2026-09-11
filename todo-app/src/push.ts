import { base64UrlToBytes } from './base64url'
import { subscribePush, unsubscribePush } from './sync/api'
import { API_URL } from './sync/config'
import type { Person, PushSubscribeBody } from './types'

// Web Push, phone side: permission, the browser's push subscription, and telling
// the sync API about it. The notifications themselves come from the worker
// (`worker/notifications.ts`) and are shown by `public/sw.js`.

/**
 * `ok`: this browser can receive push. `needs-install`: iPhone/iPad Safari, where web
 * push only exists in the app added to the home screen. `unsupported`: no push here,
 * or no server key configured.
 */
export type PushSupport = 'ok' | 'needs-install' | 'unsupported'

/** Public half of the VAPID pair (`wrangler.jsonc`), per build mode in `.env.*`; unset under Vitest. */
function vapidPublicKey(): string {
  return import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''
}

export function pushSupport(): PushSupport {
  if (!vapidPublicKey()) return 'unsupported'
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'ok'
  return isAppleMobile() && !isStandalone() ? 'needs-install' : 'unsupported'
}

function isAppleMobile(): boolean {
  const ua = navigator.userAgent
  // iPadOS Safari presents itself as a Mac; touch support gives it away.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

function isStandalone(): boolean {
  if (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) return true
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/**
 * Asks for permission, subscribes, and registers the subscription for `person`.
 * Call it straight from a tap: it asks before its first `await`, and iOS only
 * shows the prompt inside the gesture.
 */
export async function enablePush(key: string, person: Person): Promise<NotificationPermission> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission
  const subscription = await ensureSubscription(await serviceWorkerRegistration())
  await subscribePush(API_URL, key, subscribeBody(subscription, person, true))
  return permission
}

/**
 * At launch, once permission is granted: makes sure this phone is still subscribed
 * (renewing a subscription the browser dropped) and re-sends it, which also keeps its
 * time zone current. Resolves to whether the phone is subscribed. The server call may
 * fail offline; the next launch sends it again.
 */
export async function refreshPush(key: string, person: Person): Promise<boolean> {
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return false
  const subscription = await ensureSubscription(registration)
  await subscribePush(API_URL, key, subscribeBody(subscription, person, false)).catch(() => {})
  return true
}

export async function disablePush(key: string): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  // Even if this call fails, the server forgets the phone: the push service answers 410 once it's unsubscribed.
  await unsubscribePush(API_URL, key, subscription.endpoint).catch(() => {})
  await subscription.unsubscribe()
}

/** `main.tsx` registers the service worker in production builds only; in dev, turning push on registers it. */
async function serviceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (!(await navigator.serviceWorker.getRegistration())) await navigator.serviceWorker.register('./sw.js')
  return navigator.serviceWorker.ready
}

/** The current subscription, replaced if it was made with another server key (after a key change). */
async function ensureSubscription(registration: ServiceWorkerRegistration): Promise<PushSubscription> {
  const serverKey = base64UrlToBytes(vapidPublicKey())
  const existing = await registration.pushManager.getSubscription()
  if (existing && sameKey(existing.options.applicationServerKey, serverKey)) return existing
  await existing?.unsubscribe()
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey })
}

function sameKey(current: ArrayBuffer | null, expected: Uint8Array): boolean {
  if (!current) return true // The browser doesn't say: keep the subscription.
  const bytes = new Uint8Array(current)
  return bytes.length === expected.length && bytes.every((byte, i) => byte === expected[i])
}

function subscribeBody(subscription: PushSubscription, person: Person, welcome: boolean): PushSubscribeBody {
  const { keys } = subscription.toJSON()
  return {
    endpoint: subscription.endpoint,
    keys: { p256dh: keys?.p256dh ?? '', auth: keys?.auth ?? '' },
    person,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    welcome,
  }
}
