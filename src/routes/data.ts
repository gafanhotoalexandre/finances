import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { redirect } from "react-router"

import {
  SUPABASE_CONFIGURATION_MESSAGE,
  claimInvite,
  getBrowserSession,
  getFriendlyErrorMessage,
  signOutAndClearAuth,
  syncAuthStoreFromBrowserSession,
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

export type LoginActionData = {
  error: string | null
  info: string | null
}

export type InviteActionData = {
  error: string | null
  info: string | null
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
  if (!hasSupabaseEnv) {
    throw redirect("/login")
  }

  const url = new URL(request.url)
  const monthParam = url.searchParams.get("month")

  if (!isMonthParam(monthParam)) {
    url.searchParams.set("month", getCurrentMonthParam())
    throw redirect(`${url.pathname}?${url.searchParams.toString()}`)
  }

  const snapshot = await syncAuthStoreFromBrowserSession()
  if (!snapshot.session) {
    throw redirect("/login")
  }

  if (!snapshot.workspaceId || !snapshot.role) {
    throw redirect("/login?needsInvite=1")
  }

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