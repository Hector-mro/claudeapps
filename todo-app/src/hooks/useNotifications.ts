import { useCallback, useEffect, useState } from 'react'
import { countBadge, zonesFor } from '../notify'
import { disablePush, enablePush, pushSupport, refreshPush } from '../push'
import { loadAccessKey, loadPerson, savePerson } from '../storage'
import type { Person, Todo } from '../types'
import type { SyncState } from './useSync'

/**
 * `hidden`: nothing to offer (no access code, or no push in this browser).
 * `needs-install`: iPhone Safari — push only works from the home-screen app.
 * `failed`: turning notifications on didn't finish; offer to retry.
 */
export type NotificationStatus = 'hidden' | 'needs-install' | 'off' | 'busy' | 'on' | 'denied' | 'failed'

interface UseNotificationsArgs {
  syncStatus: SyncState
  todos: Todo[]
}

/**
 * This phone's push notifications (sent by the worker, see `worker/notifications.ts`)
 * and its app-icon badge. They need the access code: the server only knows synced tasks.
 */
export function useNotifications({ syncStatus, todos }: UseNotificationsArgs) {
  const [support] = useState(pushSupport)
  const [person, setPerson] = useState(loadPerson)
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    support === 'ok' ? Notification.permission : 'default',
  )
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const connected = syncStatus === 'synced' || syncStatus === 'pending' || syncStatus === 'offline'

  // At launch: is this phone still subscribed? Also re-sends the subscription to the server.
  useEffect(() => {
    const key = loadAccessKey()
    if (support !== 'ok' || !connected || permission !== 'granted' || !person || subscribed || !key) return
    let cancelled = false
    refreshPush(key, person).then(
      (ok) => {
        if (!cancelled) setSubscribed(ok)
      },
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [support, connected, permission, person, subscribed])

  const enable = useCallback((chosen: Person) => {
    const key = loadAccessKey()
    if (!key) return
    setBusy(true)
    setFailed(false)
    // No `await` before this call: iOS only shows the permission prompt inside the tap.
    enablePush(key, chosen)
      .then((result) => {
        setPermission(result)
        if (result !== 'granted') return
        savePerson(chosen)
        setPerson(chosen)
        setSubscribed(true)
      })
      .catch(() => setFailed(true))
      .finally(() => setBusy(false))
  }, [])

  const disable = useCallback(() => {
    const key = loadAccessKey()
    if (!key) return
    setBusy(true)
    disablePush(key)
      .then(() => {
        setSubscribed(false)
        if ('clearAppBadge' in navigator) void navigator.clearAppBadge().catch(() => {})
      })
      .catch(() => {})
      .finally(() => setBusy(false))
  }, [])

  let status: NotificationStatus
  if (!connected || support === 'unsupported') status = 'hidden'
  else if (support === 'needs-install') status = 'needs-install'
  else if (busy) status = 'busy'
  else if (permission === 'denied') status = 'denied'
  else if (subscribed && person) status = 'on'
  else status = failed ? 'failed' : 'off'

  // The icon badge (see `countBadge`): kept right while the app is open, and set once
  // more as it goes to the background, so the closed app shows the right count.
  const on = status === 'on'
  useEffect(() => {
    if (!on || !person || !('setAppBadge' in navigator)) return
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const update = () => {
      const count = countBadge(todos, zonesFor(person), Date.now(), timeZone)
      void (count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge()).catch(() => {})
    }
    update()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') update()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [on, person, todos])

  return { status, person, enable, disable }
}
