import { create } from "zustand"
import type { Session } from "@supabase/supabase-js"

export type AppRole = "admin" | "user"

export type WorkspaceContext = {
  role: AppRole | null
  workspaceId: string | null
}

type AuthStore = WorkspaceContext & {
  session: Session | null
  setSession: (session: Session | null) => void
  setWorkspaceContext: (context: WorkspaceContext) => void
  clearWorkspaceContext: () => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  role: null,
  workspaceId: null,
  setSession: (session) => {
    set({ session })
  },
  setWorkspaceContext: ({ role, workspaceId }) => {
    set({ role, workspaceId })
  },
  clearWorkspaceContext: () => {
    set({ role: null, workspaceId: null })
  },
  clearAuth: () => {
    set({ session: null, role: null, workspaceId: null })
  },
}))