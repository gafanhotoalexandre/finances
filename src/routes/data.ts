import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { redirect } from "react-router"

import {
  SUPABASE_CONFIGURATION_MESSAGE,
  claimInvite,
  getAuthSnapshotFromSession,
  getBrowserAuthSnapshot,
  getBrowserSession,
  getFriendlyErrorMessage,
  requireAdminAccess,
  requireWorkspaceAccess,
  signOutAndClearAuth,
  type WorkspaceAccessSnapshot,
} from "@/lib/auth"
import { buildSessionHandoffPath } from "@/lib/session-handoff"
import {
  formatMonthLabel,
  getCurrentMonthParam,
  getDashboardData,
  getReservesSummary,
  isMonthParam,
  type DashboardSummary,
  type FinanceCategory,
  type FinanceTransaction,
  type ReserveSummary,
} from "@/lib/finance"
import { hasSupabaseEnv, supabase } from "@/lib/supabase"
import type { AppRole } from "@/store/auth"

type InviteStatus = "pending" | "used" | "expired" | "revoked"

export type AdminInviteScope = "isolated-workspace" | "workspace-member"

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
  workspace_id: string | null
  workspace_name: string | null
}

type CreatedInviteRow = {
  code: string
  expires_at: string
  id: string
  requested_role: AppRole
  workspace_id: string | null
  workspace_name: string | null
}

type ExistingInviteRow = {
  id: string
  status: InviteStatus
}

type CreateAdminInviteInput = {
  scope: AdminInviteScope
  workspaceName: string | null
}

export type AdminCreatedInvite = {
  code: string
  expiresAt: string
  id: string
  requestedRole: AppRole
  scope: AdminInviteScope
  workspaceName: string | null
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

export type ReservesLoaderData = {
  configured: boolean
  reserves: ReserveSummary[]
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
  scope: AdminInviteScope
  status: InviteStatus
  visualStatus: InviteStatus
  workspaceName: string | null
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
  createdInvite: AdminCreatedInvite | null
  error: string | null
  info: string | null
  intent: AdminActionIntent | null
  revokedInviteId: string | null
}

const INVITE_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const INVITE_CODE_SEGMENT_LENGTH = 4
const MAX_INVITE_CODE_ATTEMPTS = 6
const MIN_WORKSPACE_NAME_LENGTH = 3
const MAX_WORKSPACE_NAME_LENGTH = 80

const adminFriendlyErrors: Record<string, string> = {
  INVALID_ADMIN_INTENT: "A ação administrativa enviada não foi reconhecida.",
  INVALID_INVITE_SCOPE: "Escolha o tipo de convite antes de continuar.",
  INVITE_CODE_GENERATION_FAILED:
    "Não foi possível reservar um código único depois de várias tentativas. Tente novamente.",
  INVITE_ID_REQUIRED: "Escolha um convite válido antes de revogar.",
  INVITE_REVOKE_ONLY_PENDING: "Apenas convites pendentes podem ser revogados.",
  WORKSPACE_NAME_LENGTH_INVALID:
    "O nome do novo workspace deve ter entre 3 e 80 caracteres.",
  WORKSPACE_NAME_REQUIRED:
    "Informe um nome para o novo workspace isolado antes de gerar o convite.",
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

  const snapshot = await getBrowserAuthSnapshot()
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

  const snapshot = await getBrowserAuthSnapshot()
  if (snapshot.session && snapshot.workspaceId) {
    throw redirect("/dashboard")
  }

  return {
    configured: true,
    hasSession: Boolean(snapshot.session),
    hasWorkspaceContext: Boolean(snapshot.workspaceId),
    info:
      redirectedForInvite || (snapshot.session && !snapshot.workspaceId)
        ? "Você já entrou, mas sua conta ainda não foi ligada a um workspace. Abra seu convite para continuar."
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

  const snapshot = await getBrowserAuthSnapshot()
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

export async function reservesLoader() {
  const snapshot = await requireWorkspaceAccess()
  const reserves = await getReservesSummary()

  return {
    configured: true,
    reserves,
    workspaceId: snapshot.workspaceId,
  } satisfies ReservesLoaderData
}

export async function adminLoader() {
  const snapshot = await requireAdminAccess()
  const invites = await getAdminInvites()

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

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return {
      error: getFriendlyErrorMessage(error, "Não foi possível entrar agora."),
      info: null,
    } satisfies LoginActionData
  }

  const session = data.session ?? (await getBrowserSession())

  if (!session) {
    return {
      error:
        "A entrada foi aceita, mas a sessão ainda não ficou pronta. Tente novamente em instantes.",
      info: null,
    } satisfies LoginActionData
  }

  const snapshot = await getAuthSnapshotFromSession(session)
  if (snapshot.workspaceId && snapshot.role) {
    throw redirect(buildSessionHandoffPath("login", "/dashboard"))
  }

  return {
    error: null,
    info:
      "Entrada concluída. Agora falta apenas abrir seu convite para liberar o acesso ao workspace.",
  } satisfies LoginActionData
}

export async function inviteAction({ params, request }: ActionFunctionArgs) {
  const code = params.code?.trim()
  if (!code) {
    return {
      error: "Convite inválido.",
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
        error: getFriendlyErrorMessage(error, "Não foi possível criar a conta agora."),
        info: null,
      } satisfies InviteActionData
    }

    if (!data.session) {
      return {
        error:
          "A conta foi criada, mas a entrada não ficou pronta logo em seguida. Confira se a confirmação de e-mail está desativada no Supabase para este fluxo.",
        info: null,
      } satisfies InviteActionData
    }
  }

  try {
    await claimInvite(code)
  } catch (error) {
    return {
      error: getFriendlyErrorMessage(
        error,
        "Não foi possível ativar o convite agora."
      ),
      info: null,
    } satisfies InviteActionData
  }

  throw redirect(buildSessionHandoffPath("invite", "/dashboard"))
}

export async function adminAction({ request }: ActionFunctionArgs) {
  const snapshot = await requireAdminAccess()
  const formData = await request.formData()
  const intent = getAdminActionIntent(formData.get("intent"))

  if (!intent) {
    return createAdminActionResponse({
      error: getAdminErrorMessage(
        new Error("INVALID_ADMIN_INTENT"),
        "Não foi possível entender a ação administrativa enviada."
      ),
    })
  }

  if (intent === "create-invite") {
    return handleCreateInviteAction(snapshot, formData)
  }

  return handleRevokeInviteAction(formData)
}

export async function signOutAction() {
  try {
    await signOutAndClearAuth()
  } catch (error) {
    return {
      error: getFriendlyErrorMessage(
        error,
        "Não foi possível encerrar a sessão agora."
      ),
    }
  }

  throw redirect(buildSessionHandoffPath("logout", "/login"))
}

async function handleCreateInviteAction(
  snapshot: WorkspaceAccessSnapshot,
  formData: FormData
) {
  try {
    const inviteInput = parseAdminInviteInput(formData)
    const createdInvite = await createAdminInvite(snapshot, inviteInput)

    return createAdminActionResponse({
      createdInvite,
      info: getCreateInviteSuccessMessage(createdInvite),
      intent: "create-invite",
    })
  } catch (error) {
    return createAdminActionResponse({
      error: getAdminErrorMessage(
        error,
        "Não foi possível gerar um novo convite agora."
      ),
      intent: "create-invite",
    })
  }
}

async function handleRevokeInviteAction(formData: FormData) {
  const inviteId = String(formData.get("inviteId") ?? "").trim()

  if (!inviteId) {
    return createAdminActionResponse({
      error: getAdminErrorMessage(
        new Error("INVITE_ID_REQUIRED"),
        "Escolha um convite válido antes de revogar."
      ),
      intent: "revoke-invite",
    })
  }

  try {
    await revokeAdminInvite(inviteId)

    return createAdminActionResponse({
      info: "Convite revogado e mantido no histórico administrativo.",
      intent: "revoke-invite",
      revokedInviteId: inviteId,
    })
  } catch (error) {
    return createAdminActionResponse({
      error: getAdminErrorMessage(
        error,
        "Não foi possível revogar o convite agora."
      ),
      intent: "revoke-invite",
      revokedInviteId: inviteId,
    })
  }
}

async function getAdminInvites() {
  const { data, error } = await supabase.rpc("get_admin_invites_feed")

  if (error) {
    throw error
  }

  return ((data ?? []) as AdminInviteRow[]).map(mapAdminInvite)
}

async function createAdminInvite(
  snapshot: WorkspaceAccessSnapshot,
  inviteInput: CreateAdminInviteInput
) {
  for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt += 1) {
    const code = generateInviteCode()
    const invitePayload =
      inviteInput.scope === "isolated-workspace"
        ? {
            code,
            created_by: snapshot.session.user.id,
            requested_role: "admin" as const,
            workspace_id: null,
            workspace_name: inviteInput.workspaceName,
          }
        : {
            code,
            created_by: snapshot.session.user.id,
            requested_role: "user" as const,
            workspace_id: snapshot.workspaceId,
            workspace_name: null,
          }

    const { data, error } = await supabase
      .from("invites")
      .insert(invitePayload)
      .select("id, code, expires_at, requested_role, workspace_id, workspace_name")
      .single()

    if (!error) {
      const row = data as CreatedInviteRow

      return mapCreatedInvite(row)
    }

    if (getErrorCode(error) === "23505") {
      continue
    }

    throw error
  }

  throw new Error("INVITE_CODE_GENERATION_FAILED")
}

async function revokeAdminInvite(inviteId: string) {
  const { data: existingInvite, error: readError } = await supabase
    .from("invites")
    .select("id, status")
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
    scope: getInviteScopeFromWorkspaceId(row.workspace_id),
    status: row.status,
    visualStatus: getVisualInviteStatus(row.status, row.expires_at),
    workspaceName: row.workspace_name,
  }
}

function mapCreatedInvite(row: CreatedInviteRow): AdminCreatedInvite {
  return {
    code: row.code,
    expiresAt: row.expires_at,
    id: row.id,
    requestedRole: row.requested_role,
    scope: getInviteScopeFromWorkspaceId(row.workspace_id),
    workspaceName: row.workspace_name,
  }
}

function parseAdminInviteInput(formData: FormData): CreateAdminInviteInput {
  const scope = getAdminInviteScope(formData.get("inviteScope"))

  if (!scope) {
    throw new Error("INVALID_INVITE_SCOPE")
  }

  if (scope === "workspace-member") {
    return {
      scope,
      workspaceName: null,
    }
  }

  const workspaceName = String(formData.get("workspaceName") ?? "").trim()

  if (!workspaceName) {
    throw new Error("WORKSPACE_NAME_REQUIRED")
  }

  if (
    workspaceName.length < MIN_WORKSPACE_NAME_LENGTH ||
    workspaceName.length > MAX_WORKSPACE_NAME_LENGTH
  ) {
    throw new Error("WORKSPACE_NAME_LENGTH_INVALID")
  }

  return {
    scope,
    workspaceName,
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

function getAdminInviteScope(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null
  }

  if (value === "isolated-workspace" || value === "workspace-member") {
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

function getInviteScopeFromWorkspaceId(
  workspaceId: string | null
): AdminInviteScope {
  if (workspaceId === null) {
    return "isolated-workspace"
  }

  return "workspace-member"
}

function getCreateInviteSuccessMessage(createdInvite: AdminCreatedInvite) {
  if (createdInvite.scope === "isolated-workspace") {
    return `Convite para o novo workspace isolado ${createdInvite.workspaceName ?? "sem nome"} gerado. Copie o link completo e envie para iniciar esse espaço.`
  }

  return "Convite de membro do seu workspace gerado. Copie o link completo e envie para a pessoa certa."
}

function toShortUserIdentifier(userId: string | null) {
  if (!userId) {
    return null
  }

  const compactUserId = userId.replace(/-/g, "")

  return `${compactUserId.slice(0, 8)}...${compactUserId.slice(-4)}`
}