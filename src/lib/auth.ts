import type { Session } from "@supabase/supabase-js"

import { supabase, hasSupabaseEnv } from "@/lib/supabase"
import { useAuthStore, type AppRole, type WorkspaceContext } from "@/store/auth"

type AuthSnapshot = WorkspaceContext & {
  session: Session | null
}

type UserRoleRow = {
  role: AppRole
  workspace_id: string
}

type ClaimInviteRow = {
  assigned_role: AppRole
  created_workspace: boolean
  invite_id: string
  workspace_id: string
}

export const SUPABASE_CONFIGURATION_MESSAGE =
  "As chaves do Supabase ainda nao foram configuradas. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para liberar login e convite."

const friendlyErrors: Record<string, string> = {
  AUTHENTICATION_REQUIRED: "Voce precisa estar autenticado para continuar.",
  INVITE_ALREADY_USED: "Esse convite ja foi utilizado.",
  INVITE_CODE_REQUIRED: "Informe um codigo de convite valido.",
  INVITE_EXPIRED: "Esse convite expirou.",
  INVITE_NOT_FOUND: "Convite nao encontrado.",
  INVITE_NOT_PENDING: "Esse convite nao esta mais disponivel.",
  INVITE_REVOKED: "Esse convite foi revogado.",
  INVITE_WORKSPACE_NOT_FOUND: "O workspace desse convite nao foi encontrado.",
  SUPABASE_ENV_MISSING: SUPABASE_CONFIGURATION_MESSAGE,
  USER_ALREADY_LINKED_TO_WORKSPACE:
    "Sua conta ja esta vinculada a um workspace.",
}

function getErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error
  }

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const maybeMessage = error.message
    if (typeof maybeMessage === "string") {
      return maybeMessage
    }
  }

  return "UNKNOWN_ERROR"
}

export function getFriendlyErrorMessage(
  error: unknown,
  fallback = "Nao foi possivel concluir a operacao."
) {
  const message = getErrorMessage(error)

  if (message in friendlyErrors) {
    return friendlyErrors[message]
  }

  const normalizedMessage = message.toLowerCase()
  if (normalizedMessage.includes("invalid login credentials")) {
    return "E-mail ou senha invalidos."
  }

  if (normalizedMessage.includes("user already registered")) {
    return "Essa conta ja existe. Entre e reabra o convite para continuar."
  }

  if (normalizedMessage.includes("email not confirmed")) {
    return "Para este fluxo funcionar de ponta a ponta, a confirmacao de e-mail precisa estar desativada no projeto Supabase."
  }

  return fallback
}

export async function getBrowserSession() {
  if (!hasSupabaseEnv) {
    return null
  }

  const { data, error } = await supabase.auth.getSession()

  if (error) {
    throw error
  }

  return data.session
}

export async function fetchWorkspaceContext(userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("workspace_id, role")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  const row = (data as UserRoleRow | null) ?? null

  return {
    role: row?.role ?? null,
    workspaceId: row?.workspace_id ?? null,
  } satisfies WorkspaceContext
}

export async function syncAuthStoreFromSession(session: Session | null) {
  if (session === null) {
    useAuthStore.getState().clearAuth()
    return {
      role: null,
      session: null,
      workspaceId: null,
    } satisfies AuthSnapshot
  }

  useAuthStore.getState().setSession(session)

  const context = await fetchWorkspaceContext(session.user.id)
  useAuthStore.getState().setWorkspaceContext(context)

  return {
    session,
    ...context,
  } satisfies AuthSnapshot
}

export async function syncAuthStoreFromBrowserSession() {
  if (!hasSupabaseEnv) {
    useAuthStore.getState().clearAuth()
    return {
      role: null,
      session: null,
      workspaceId: null,
    } satisfies AuthSnapshot
  }

  const session = await getBrowserSession()
  return syncAuthStoreFromSession(session)
}

export async function claimInvite(code: string) {
  const { data, error } = await supabase.rpc("claim_invite", {
    p_code: code,
  })

  if (error) {
    throw error
  }

  if (Array.isArray(data)) {
    return (data[0] ?? null) as ClaimInviteRow | null
  }

  return (data ?? null) as ClaimInviteRow | null
}

export async function signOutAndClearAuth() {
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw error
  }

  useAuthStore.getState().clearAuth()
}