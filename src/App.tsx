import * as React from "react"
import { Outlet, ScrollRestoration } from "react-router"

import { syncAuthStoreFromBrowserSession } from "@/lib/auth"
import { hasSupabaseEnv, supabase } from "@/lib/supabase"
import { useAuthStore } from "@/store/auth"

export function App() {
  React.useEffect(() => {
    if (!hasSupabaseEnv) {
      useAuthStore.getState().clearAuth()
      return undefined
    }

    void syncAuthStoreFromBrowserSession()

    let syncTimer: number | null = null
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      useAuthStore.getState().setSession(session)

      if (syncTimer !== null) {
        window.clearTimeout(syncTimer)
        syncTimer = null
      }

      if (session === null) {
        useAuthStore.getState().clearAuth()
        return
      }

      syncTimer = window.setTimeout(() => {
        void syncAuthStoreFromBrowserSession()
      }, 0)
    })

    return () => {
      if (syncTimer !== null) {
        window.clearTimeout(syncTimer)
      }

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
