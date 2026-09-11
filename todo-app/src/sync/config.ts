import { saveAccessKey } from '../storage'

/** Base URL of the sync API (`worker/`), set per build mode in `.env.development` / `.env.production`. */
export const API_URL: string = import.meta.env.VITE_API_URL ?? ''

/** A share link carries the access code in its fragment: `…/todo-app/#cle=<code>`. */
const HASH_PREFIX = '#cle='

/**
 * Adopts the access code from a share link, then drops it from the address bar
 * so it doesn't linger in history or bookmarks. (A fragment never reaches the server.)
 */
export function adoptAccessKeyFromLocation(): void {
  if (!location.hash.startsWith(HASH_PREFIX)) return
  const key = decodeURIComponent(location.hash.slice(HASH_PREFIX.length)).trim()
  if (key) saveAccessKey(key)
  history.replaceState(null, '', location.pathname + location.search)
}
