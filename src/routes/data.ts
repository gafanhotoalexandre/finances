import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { redirect } from "react-router"

import {
  SUPABASE_CONFIGURATION_MESSAGE,
  claimInvite,
  getBrowserSession,
  getFriendlyErrorMessage,
  requireAdminAccess,
  requireWorkspaceAccess,
  signOutAndClearAuth,
  syncAuthStoreFromBrowserSession,
  type WorkspaceAccessSnapshot,
} from "@/lib/auth"
import {
  formatMonthLabel,
  getCurrentMonthParam,
  getDashboardData,
  isMonthParam,
  type DashboardSummary,
  type FinanceCategory,
  type FinanceTransaction,
} from "@/lib/finance"
import { hasSupabaseEnv, supabase } from "@/lib/supabase"
import type { AppRole } from "@/store/auth"

type InviteStatus = "pending" | "used" | "expired" | "revoked"

type AdminInviteRow = {
  claimed_at: string | null
  claimed_at_snapshot: string | null
  claimed_by: string | null
  claimed_by_snapshot: string | null
  code: string
  created_at: string
  expires_at: string
  id: string
  requested_role: AppRole
  revoked_at: string | null
  status: InviteStatus
}

type CreatedInviteRow = {
  code: string
  expires_at: string
  id: string
}

type ExistingInviteRow = {
  id: string
  status: InviteStatus
}

export type RootLoaderData = {
  configured: boolean
  hasSession: boolean
}

export type LoginLoaderData = {
  configured: boolean
  hasSession: boolean
  hasWorkspaceContext: boolean
  info: string | null
}

export type InviteLoaderData = {
  code: string
  configured: boolean
  sessionEmail: string | null
}

export type DashboardLoaderData = {
  categories: FinanceCategory[]
  configured: boolean
  month: string
  monthLabel: string
  summary: DashboardSummary
  transactions: FinanceTransaction[]
  workspaceId: string
}

export type AdminInviteRecord = {
  claimedAt: string | null
  claimedAtSnapshot: string | null
  claimedBy: string | null
  claimedByShort: string | null
  claimedBySnapshot: string | null
  claimedBySnapshotShort: string | null
  code: string
  createdAt: string
  expiresAt: string
  id: string
  requestedRole: AppRole
  revokedAt: string | null
  status: InviteStatus
  visualStatus: InviteStatus
}

export type AdminLoaderData = {
  configured: boolean
  invites: AdminInviteRecord[]
  workspaceId: string
}

export type LoginActionData = {
  error: string | null
  info: string | null
}

export type InviteActionData = {
  error: string | null
  info: string | null
}

export type AdminActionIntent = "create-invite" | "revoke-invite"

export type AdminActionData = {
  createdInvite: {
    code: string
    expiresAt: string
    id: string
  } | null
  error: string | null
  info: string | null
  intent: AdminActionIntent | null
  revokedInviteId: string | null
}

const INVITE_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const INVITE_CODE_SEGMENT_LENGTH = 4
const MAX_INVITE_CODE_ATTEMPTS = 6

const adminFriendlyErrors: Record<string, string> = {
  INVALID_ADMIN_INTENT: "A acao administrativa enviada nao foi reconhecida.",
  INVITE_CODE_GENERATION_FAILED:
    "Nao foi possivel reservar um codigo unico depois de varias tentativas. Tente novamente.",
  INVITE_ID_REQUIRED: "Escolha um convite valido antes de revogar.",
  INVITE_REVOKE_ONLY_PENDING: "Apenas convites pendentes podem ser revogados.",
}

export async function rootLoader() {
  if (!hasSupabaseEnv) {
    return {
      configured: false,
      hasSession: false,
    } satisfies RootLoaderData
  }

  const session = await getBrowserSession()

  return {
    configured: true,
    hasSession: Boolean(session),
  } satisfies RootLoaderData
}

export async function indexLoader() {
  if (!hasSupabaseEnv) {
    throw redirect("/login")
  }

  const snapshot = await syncAuthStoreFromBrowserSession()
  if (snapshot.session && snapshot.workspaceId) {
    throw redirect("/dashboard")
  }

  throw redirect("/login")
}

export async function loginLoader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const redirectedForInvite = url.searchParams.get("needsInvite") === "1"

  if (!hasSupabaseEnv) {
    return {
      configured: false,
      hasSession: false,
      hasWorkspaceContext: false,
      info: SUPABASE_CONFIGURATION_MESSAGE,
    } satisfies LoginLoaderData
  }

  const snapshot = await syncAuthStoreFromBrowserSession()
  if (snapshot.session && snapshot.workspaceId) {
    throw redirect("/dashboard")
  }

  return {
    configured: true,
    hasSession: Boolean(snapshot.session),
    hasWorkspaceContext: Boolean(snapshot.workspaceId),
    info:
      redirectedForInvite || (snapshot.session && !snapshot.workspaceId)
        ? "Voce ja entrou, mas sua conta ainda nao foi ligada a um espaco. Abra seu convite para continuar."
        : null,
  } satisfies LoginLoaderData
}

export async function inviteLoader({ params }: LoaderFunctionArgs) {
  const code = params.code?.trim()
  if (!code) {
    throw redirect("/login")
  }

  if (!hasSupabaseEnv) {
    return {
      code,
      configured: false,
      sessionEmail: null,
    } satisfies InviteLoaderData
  }

  const snapshot = await syncAuthStoreFromBrowserSession()
  if (snapshot.session && snapshot.workspaceId) {
    throw redirect("/dashboard")
  }

  return {
    code,
    configured: true,
    sessionEmail: snapshot.session?.user.email ?? null,
  } satisfies InviteLoaderData
}

export async function dashboardLoader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const monthParam = url.searchParams.get("month")

  if (!isMonthParam(monthParam)) {
    url.searchParams.set("month", getCurrentMonthParam())
    throw redirect(`${url.pathname}?${url.searchParams.toString()}`)
  }

  const snapshot = await requireWorkspaceAccess()

  const dashboardData = await getDashboardData(monthParam)

  return {
    categories: dashboardData.categories,
    configured: true,
    month: monthParam,
    monthLabel: formatMonthLabel(monthParam),
    summary: dashboardData.summary,
    transactions: dashboardData.transactions,
    workspaceId: snapshot.workspaceId,
  } satisfies DashboardLoaderData
}

export async function adminLoader() {
  const snapshot = await requireAdminAccess()
  const invites = await getAdminInvites(snapshot.workspaceId)

  return {
    configured: true,
    invites,
    workspaceId: snapshot.workspaceId,
  } satisfies AdminLoaderData
}

export async function loginAction({ request }: ActionFunctionArgs) {
  if (!hasSupabaseEnv) {
    return {
      error: SUPABASE_CONFIGURATION_MESSAGE,
      info: null,
    } satisfies LoginActionData
  }

  const formData = await request.formData()
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!email || !password) {
    return {
      error: "Preencha e-mail e senha para continuar.",
      info: null,
    } satisfies LoginActionData
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return {
      error: getFriendlyErrorMessage(error, "Nao foi possivel entrar agora."),
      info: null,
    } satisfies LoginActionData
  }

  const snapshot = await syncAuthStoreFromBrowserSession()
  if (snapshot.workspaceId) {
    throw redirect("/dashboard")
  }

  return {
    error: null,
    info:
      "Entrada concluida. Agora falta apenas abrir seu convite para liberar o acesso ao espaco.",
  } satisfies LoginActionData
}

export async function inviteAction({ params, request }: ActionFunctionArgs) {
  const code = params.code?.trim()
  if (!code) {
    return {
      error: "Convite invalido.",
      info: null,
    } satisfies InviteActionData
  }

  if (!hasSupabaseEnv) {
    return {
      error: SUPABASE_CONFIGURATION_MESSAGE,
      info: null,
    } satisfies InviteActionData
  }

  const session = await getBrowserSession()

  if (!session) {
    const formData = await request.formData()
    const email = String(formData.get("email") ?? "").trim()
    const password = String(formData.get("password") ?? "")

    if (!email || !password) {
      return {
        error: "Preencha e-mail e senha para criar sua conta e ativar o convite.",
        info: null,
      } satisfies InviteActionData
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      return {
        error: getFriendlyErrorMessage(error, "Nao foi possivel criar a conta agora."),
        info: null,
      } satisfies InviteActionData
    }

    if (!data.session) {
      return {
        error:
          "A conta foi criada, mas a entrada nao ficou pronta logo em seguida. Confira se a confirmacao de e-mail esta desativada no Supabase para este fluxo.",
        info: null,
      } satisfies InviteActionData
    }
  }

  try {
    await claimInvite(code)
    const snapshot = await syncAuthStoreFromBrowserSession()

    if (snapshot.workspaceId && snapshot.role) {
      throw redirect("/dashboard")
    }

    return {
      error: null,
      info: "O convite foi ativado, mas seu acesso ainda nao ficou pronto. Tente entrar novamente em instantes.",
    } satisfies InviteActionData
  } catch (error) {
    return {
      error: getFriendlyErrorMessage(
        error,
        "Nao foi possivel ativar o convite agora."
      ),
      info: null,
    } satisfies InviteActionData
  }
}

export async function adminAction({ request }: ActionFunctionArgs) {
  const snapshot = await requireAdminAccess()
  const formData = await request.formData()
  const intent = getAdminActionIntent(formData.get("intent"))

  if (!intent) {
    return createAdminActionResponse({
      error: getAdminErrorMessage(
        new Error("INVALID_ADMIN_INTENT"),
        "Nao foi possivel entender a acao administrativa enviada."
      ),
    })
  }

  if (intent === "create-invite") {
    return handleCreateInviteAction(snapshot)
  }

  return handleRevokeInviteAction(snapshot, formData)
}

export async function signOutAction() {
  try {
    await signOutAndClearAuth()
  } catch (error) {
    return {
      error: getFriendlyErrorMessage(
        error,
        "Nao foi possivel encerrar a sessao agora."
      ),
    }
  }

  throw redirect("/login")
}

async function handleCreateInviteAction(snapshot: WorkspaceAccessSnapshot) {
  try {
    const createdInvite = await createAdminInvite(snapshot)

    return createAdminActionResponse({
      createdInvite,
      info: "Convite gerado. Copie o link completo e envie para a pessoa certa.",
      intent: "create-invite",
    })
  } catch (error) {
    return createAdminActionResponse({
      error: getAdminErrorMessage(
        error,
        "Nao foi possivel gerar um novo convite agora."
      ),
      intent: "create-invite",
    })
  }
}

async function handleRevokeInviteAction(
  snapshot: WorkspaceAccessSnapshot,
  formData: FormData
) {
  const inviteId = String(formData.get("inviteId") ?? "").trim()

  if (!inviteId) {
    return createAdminActionResponse({
      error: getAdminErrorMessage(
        new Error("INVITE_ID_REQUIRED"),
        "Escolha um convite valido antes de revogar."
      ),
      intent: "revoke-invite",
    })
  }

  try {
    await revokeAdminInvite(snapshot.workspaceId, inviteId)

    return createAdminActionResponse({
      info: "Convite revogado e mantido no historico do workspace.",
      intent: "revoke-invite",
      revokedInviteId: inviteId,
    })
  } catch (error) {
    return createAdminActionResponse({
      error: getAdminErrorMessage(
        error,
        "Nao foi possivel revogar o convite agora."
      ),
      intent: "revoke-invite",
      revokedInviteId: inviteId,
    })
  }
}

async function getAdminInvites(workspaceId: string) {
  const { data, error } = await supabase
    .from("invites")
    .select(
      "id, code, requested_role, status, expires_at, created_at, revoked_at, claimed_at, claimed_by, claimed_at_snapshot, claimed_by_snapshot"
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return ((data ?? []) as AdminInviteRow[]).map(mapAdminInvite)
}

async function createAdminInvite(snapshot: WorkspaceAccessSnapshot) {
  for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt += 1) {
    const code = generateInviteCode()
    const { data, error } = await supabase
      .from("invites")
      .insert({
        code,
        created_by: snapshot.session.user.id,
        requested_role: "user",
        workspace_id: snapshot.workspaceId,
      })
      .select("id, code, expires_at")
      .single()

    if (!error) {
      const row = data as CreatedInviteRow

      return {
        code: row.code,
        expiresAt: row.expires_at,
        id: row.id,
      }
    }

    if (getErrorCode(error) === "23505") {
      continue
    }

    throw error
  }

  throw new Error("INVITE_CODE_GENERATION_FAILED")
}

async function revokeAdminInvite(workspaceId: string, inviteId: string) {
  const { data: existingInvite, error: readError } = await supabase
    .from("invites")
    .select("id, status")
    .eq("workspace_id", workspaceId)
    .eq("id", inviteId)
    .maybeSingle()

  if (readError) {
    throw readError
  }

  const invite = (existingInvite as ExistingInviteRow | null) ?? null

  if (!invite) {
    throw new Error("INVITE_NOT_FOUND")
  }

  if (invite.status !== "pending") {
    throw new Error("INVITE_REVOKE_ONLY_PENDING")
  }

  const { data: revokedInvite, error: revokeError } = await supabase
    .from("invites")
    .update({
      revoked_at: new Date().toISOString(),
      status: "revoked",
    })
    .eq("workspace_id", workspaceId)
    .eq("id", inviteId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle()

  if (revokeError) {
    throw revokeError
  }

  if (!revokedInvite) {
    throw new Error("INVITE_REVOKE_ONLY_PENDING")
  }
}

function createAdminActionResponse(
  overrides: Partial<AdminActionData>
): AdminActionData {
  return {
    createdInvite: null,
    error: null,
    info: null,
    intent: null,
    revokedInviteId: null,
    ...overrides,
  }
}

function mapAdminInvite(row: AdminInviteRow): AdminInviteRecord {
  return {
    claimedAt: row.claimed_at,
    claimedAtSnapshot: row.claimed_at_snapshot,
    claimedBy: row.claimed_by,
    claimedByShort: toShortUserIdentifier(row.claimed_by),
    claimedBySnapshot: row.claimed_by_snapshot,
    claimedBySnapshotShort: toShortUserIdentifier(row.claimed_by_snapshot),
    code: row.code,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    id: row.id,
    requestedRole: row.requested_role,
    revokedAt: row.revoked_at,
    status: row.status,
    visualStatus: getVisualInviteStatus(row.status, row.expires_at),
  }
}

function generateInviteCode() {
  return `FIN-${generateInviteCodeSegment()}-${generateInviteCodeSegment()}`
}

function generateInviteCodeSegment() {
  const values = crypto.getRandomValues(
    new Uint32Array(INVITE_CODE_SEGMENT_LENGTH)
  )

  return Array.from(values, (value) => {
    return INVITE_CODE_ALPHABET[value % INVITE_CODE_ALPHABET.length]
  }).join("")
}

function getAdminActionIntent(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null
  }

  if (value === "create-invite" || value === "revoke-invite") {
    return value
  }

  return null
}

function getAdminErrorMessage(error: unknown, fallback: string) {
  const message = getErrorMessage(error)

  if (message in adminFriendlyErrors) {
    return adminFriendlyErrors[message]
  }

  return getFriendlyErrorMessage(error, fallback)
}

function getErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const maybeCode = error.code

    if (typeof maybeCode === "string") {
      return maybeCode
    }
  }

  return null
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

function getVisualInviteStatus(status: InviteStatus, expiresAt: string) {
  if (status === "pending" && Date.parse(expiresAt) <= Date.now()) {
    return "expired"
  }

  return status
}

function toShortUserIdentifier(userId: string | null) {
  if (!userId) {
    return null
  }

  const compactUserId = userId.replace(/-/g, "")

  return `${compactUserId.slice(0, 8)}...${compactUserId.slice(-4)}`
}