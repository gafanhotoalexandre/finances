import * as React from "react"
import type { Session } from "@supabase/supabase-js"
import { Outlet, ScrollRestoration } from "react-router"

import {
  applyAuthSnapshot,
  getAuthSnapshotFromSession,
  getBrowserAuthSnapshot,
} from "@/lib/auth"
import { hasSupabaseEnv, supabase } from "@/lib/supabase"
import { useAuthStore } from "@/store/auth"

export function App() {
  React.useEffect(() => {
    if (!hasSupabaseEnv) {
      useAuthStore.getState().clearAuth()
      return undefined
    }

    let cancelled = false
    let syncVersion = 0

    function isStale(version: number) {
      return cancelled || version !== syncVersion
    }

    async function syncFromBrowserSession() {
      const version = ++syncVersion

      try {
        const snapshot = await getBrowserAuthSnapshot()

        if (isStale(version)) {
          return
        }

        applyAuthSnapshot(snapshot)
      } catch {
        if (isStale(version)) {
          return
        }

        useAuthStore.getState().clearAuth()
      }
    }

    async function syncFromAuthChange(session: Session | null) {
      const version = ++syncVersion

      try {
        const snapshot = await getAuthSnapshotFromSession(session)

        if (isStale(version)) {
          return
        }

        applyAuthSnapshot(snapshot)
      } catch {
        if (isStale(version)) {
          return
        }

        if (session === null) {
          useAuthStore.getState().clearAuth()
          return
        }

        useAuthStore.getState().setSession(session)
        useAuthStore.getState().clearWorkspaceContext()
      }
    }

    void syncFromBrowserSession()

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncFromAuthChange(session)
    })

    return () => {
      cancelled = true
      syncVersion += 1
      data.subscription.unsubscribe()
    }
  }, [])

  return (
    <>
      <Outlet />
      <ScrollRestoration />
    </>
  )
}

export default App
