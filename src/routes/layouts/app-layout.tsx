import * as React from "react"
import {
  CircleUserRoundIcon,
  LayoutDashboardIcon,
  PiggyBankIcon,
  ShieldCheckIcon,
  TerminalSquareIcon,
} from "lucide-react"
import { Form, NavLink, Outlet, useNavigation } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { APP_VERSION } from "@/lib/app-meta"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/auth"

const NICKNAME_STORAGE_PREFIX = "project-finance:nickname:"

function getShellNavLinkClassName(isActive: boolean) {
  return cn(
    "inline-flex h-9 items-center rounded-2xl border px-4 text-[11px] font-medium tracking-[0.18em] uppercase transition-colors",
    isActive
      ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
      : "border-white/60 bg-white/55 text-slate-700 hover:bg-white/78 dark:border-slate-700/70 dark:bg-slate-950/55 dark:text-slate-200 dark:hover:bg-slate-900/80"
  )
}

function getBottomNavLinkClassName(isActive: boolean) {
  return cn(
    "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-[18px] px-2 py-2 text-[10px] font-medium tracking-[0.18em] uppercase transition-colors",
    isActive
      ? "bg-slate-900 text-white shadow-[0_18px_36px_-26px_rgba(15,23,42,0.8)] dark:bg-slate-100 dark:text-slate-900"
      : "text-slate-500 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900/80 dark:hover:text-slate-50"
  )
}

function getFallbackDisplayName(email: string | null | undefined) {
  if (!email) {
    return "Perfil"
  }

  const [localPart] = email.split("@")
  return localPart?.trim() || "Perfil"
}

function getInitials(value: string) {
  const tokens = value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)

  if (tokens.length === 0) {
    return "PF"
  }

  const first = tokens[0]?.[0] ?? "P"
  const second = tokens[1]?.[0] ?? tokens[0]?.[1] ?? "F"

  return `${first}${second}`.toUpperCase()
}

function readStoredNickname(storageKey: string | null) {
  if (!storageKey || typeof window === "undefined") {
    return ""
  }

  return window.localStorage.getItem(storageKey) ?? ""
}

export function AppLayout() {
  const navigation = useNavigation()
  const session = useAuthStore((state) => state.session)
  const role = useAuthStore((state) => state.role)
  const workspaceId = useAuthStore((state) => state.workspaceId)
  const isRouteLoading = navigation.state === "loading"
  const isSigningOut =
    navigation.state === "submitting" &&
    navigation.formMethod?.toLowerCase() === "post" &&
    navigation.formAction?.endsWith("/dashboard/sign-out")

  const navItems = React.useMemo(() => {
    const items = [
      {
        icon: LayoutDashboardIcon,
        label: "Dashboard",
        to: "/dashboard",
      },
      {
        icon: PiggyBankIcon,
        label: "Reservas",
        to: "/reservas",
      },
    ]

    if (role === "admin") {
      items.push({
        icon: ShieldCheckIcon,
        label: "Admin",
        to: "/admin",
      })
    }

    return items
  }, [role])

  const nicknameStorageKey = session?.user.id
    ? `${NICKNAME_STORAGE_PREFIX}${session.user.id}`
    : null

  const [nicknameDraft, setNicknameDraft] = React.useState("")
  const [profileOpen, setProfileOpen] = React.useState(false)
  const [profileFeedback, setProfileFeedback] = React.useState<{
    message: string
    tone: "error" | "success"
  } | null>(null)

  const savedNickname = readStoredNickname(nicknameStorageKey)

  const fallbackDisplayName = getFallbackDisplayName(session?.user.email)
  const profileName = savedNickname.trim() || fallbackDisplayName
  const profileInitials = getInitials(profileName)

  function handleProfileOpenChange(open: boolean) {
    setProfileOpen(open)

    if (open) {
      setNicknameDraft(savedNickname)
      setProfileFeedback(null)
    }
  }

  function handleSaveNickname() {
    if (!nicknameStorageKey) {
      setProfileFeedback({
        message: "A sessão ainda não ficou pronta para salvar o apelido local.",
        tone: "error",
      })
      return
    }

    const normalizedNickname = nicknameDraft.trim()

    if (normalizedNickname) {
      window.localStorage.setItem(nicknameStorageKey, normalizedNickname)
    } else {
      window.localStorage.removeItem(nicknameStorageKey)
    }

    setProfileFeedback({
      message: normalizedNickname
        ? "Apelido salvo neste dispositivo."
        : "Apelido removido deste dispositivo.",
      tone: "success",
    })
  }

  return (
    <div className="bg-blueprint relative min-h-svh overflow-hidden">
      {isRouteLoading ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-50 h-1 overflow-hidden bg-slate-200/60 dark:bg-slate-800/60"
        >
          <div className="animate-shell-progress h-full w-2/5 bg-linear-to-r from-cyan-400 via-sky-500 to-indigo-500 shadow-[0_0_24px_rgba(59,130,246,0.45)]" />
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.07),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.08),transparent_28%)]" />

      <header className="relative z-10 px-3 pt-3 sm:px-6 lg:px-8 lg:pt-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
          <div className="glass-card flex items-center justify-between rounded-[22px] border-white/55 px-4 py-3 dark:border-slate-700/70 dark:bg-slate-950/55 lg:hidden">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-[18px] border border-white/70 bg-white/78 text-slate-800 shadow-[0_18px_34px_-28px_rgba(14,165,233,0.55)] dark:border-slate-700/70 dark:bg-slate-950/72 dark:text-slate-100">
                <TerminalSquareIcon className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-medium tracking-[0.24em] uppercase text-slate-500 dark:text-slate-400">
                    SYS::FINANCE
                  </span>
                  <Badge
                    variant="outline"
                    className="border-white/65 bg-white/70 px-2 text-[10px] tracking-[0.16em] uppercase dark:border-slate-700/70 dark:bg-slate-950/60"
                  >
                    v{APP_VERSION}
                  </Badge>
                </div>
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                  {profileName}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 rounded-[18px] border-white/60 bg-white/68 dark:border-slate-700/70 dark:bg-slate-950/62"
              onClick={() => handleProfileOpenChange(true)}
            >
              <CircleUserRoundIcon className="size-5" />
              <span className="sr-only">Abrir perfil</span>
            </Button>
          </div>

          <div className="glass-card hidden w-full rounded-[28px] border-white/55 px-5 py-5 dark:border-slate-700/70 dark:bg-slate-950/55 lg:flex lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-300">
                <TerminalSquareIcon className="size-4" />
                <span className="font-mono text-[10px] font-medium tracking-[0.24em] uppercase">
                  SYS::FINANCE
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                  Project Finance
                </h1>
                <Badge
                  variant="outline"
                  className="border-white/60 bg-white/55 text-[11px] tracking-[0.22em] uppercase dark:border-slate-700/70 dark:bg-slate-950/55"
                >
                  v{APP_VERSION}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <span className="max-w-full truncate sm:max-w-none">
                  {session?.user.email ?? "Sessão sem e-mail"}
                </span>
                <Separator orientation="vertical" className="hidden h-4 sm:block" />
                <span className="font-mono uppercase">{role ?? "sem role"}</span>
                <Separator orientation="vertical" className="hidden h-4 sm:block" />
                <span className="font-mono text-xs">{workspaceId ?? "sem workspace"}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => getShellNavLinkClassName(isActive)}
                >
                  {item.label}
                </NavLink>
              ))}

              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-[18px] border-white/60 bg-white/65 px-2.5 dark:border-slate-700/70 dark:bg-slate-950/60"
                onClick={() => handleProfileOpenChange(true)}
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-slate-900 text-[11px] font-medium tracking-[0.14em] uppercase text-white dark:bg-slate-100 dark:text-slate-900">
                  {profileInitials}
                </span>
                <span className="max-w-28 truncate text-[11px] font-medium tracking-[0.18em] uppercase">
                  {profileName}
                </span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main
        className={cn(
          "relative z-10 mx-auto w-full max-w-6xl px-3 py-5 pb-28 transition-opacity duration-200 sm:px-6 sm:py-6 sm:pb-32 lg:px-8 lg:pb-6",
          isRouteLoading ? "opacity-50" : "opacity-100"
        )}
      >
        <Outlet />
      </main>

      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom,0)+0.75rem)] lg:hidden">
        <div className="glass-card pointer-events-auto mx-auto flex w-full max-w-6xl items-center gap-1 rounded-[26px] border-white/60 bg-white/84 p-2 shadow-[0_34px_80px_-48px_rgba(15,23,42,0.72)] dark:border-slate-700/70 dark:bg-slate-950/84">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => getBottomNavLinkClassName(isActive)}
            >
              <item.icon className="size-4.5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <Dialog open={profileOpen} onOpenChange={handleProfileOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Perfil da sessão</DialogTitle>
            <DialogDescription>
              Centralize identidade, contexto do workspace e encerramento da sessão num único painel.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5 px-5 pb-2 sm:px-6">
            <div className="glass-card flex items-start gap-4 rounded-[24px] border-white/60 bg-white/78 p-4 dark:border-slate-700/70 dark:bg-slate-950/64">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-[20px] bg-slate-900 text-sm font-semibold tracking-[0.16em] uppercase text-white dark:bg-slate-100 dark:text-slate-900">
                {profileInitials}
              </div>
              <div className="min-w-0 space-y-1.5">
                <p className="truncate text-base font-semibold text-slate-900 dark:text-slate-50">
                  {profileName}
                </p>
                <p className="truncate text-sm text-slate-600 dark:text-slate-300">
                  {session?.user.email ?? "Sessão sem e-mail"}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge
                    variant="outline"
                    className="border-white/60 bg-white/65 text-[10px] tracking-[0.16em] uppercase dark:border-slate-700/70 dark:bg-slate-950/60"
                  >
                    {role ?? "sem role"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-white/60 bg-white/65 text-[10px] tracking-[0.16em] uppercase dark:border-slate-700/70 dark:bg-slate-950/60"
                  >
                    v{APP_VERSION}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid gap-3 rounded-[24px] border border-white/60 bg-white/68 p-4 text-sm text-slate-600 dark:border-slate-700/70 dark:bg-slate-950/58 dark:text-slate-300 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-slate-500 dark:text-slate-400">
                  Workspace
                </p>
                <p className="break-all font-medium text-slate-800 dark:text-slate-100">
                  {workspaceId ?? "Sem workspace vinculado"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-slate-500 dark:text-slate-400">
                  Contexto
                </p>
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  {role === "admin"
                    ? "Acesso administrativo habilitado"
                    : "Sessão operacional padrão"}
                </p>
              </div>
            </div>

            <Field>
              <FieldLabel htmlFor="profile-nickname">Apelido</FieldLabel>
              <Input
                id="profile-nickname"
                value={nicknameDraft}
                onChange={(event) => {
                  setNicknameDraft(event.target.value)
                  setProfileFeedback(null)
                }}
                placeholder={fallbackDisplayName}
              />
              <FieldDescription>
                Salvo localmente neste navegador para personalizar o topo da aplicação.
              </FieldDescription>
            </Field>

            {profileFeedback ? (
              <div
                className={cn(
                  "rounded-[18px] border px-3 py-2 text-sm",
                  profileFeedback.tone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                    : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
                )}
              >
                {profileFeedback.message}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Form method="post" action="/dashboard/sign-out" className="w-full sm:w-auto">
              <Button
                variant="outline"
                type="submit"
                disabled={isSigningOut}
                className="w-full sm:w-auto"
              >
                {isSigningOut ? "Saindo..." : "Encerrar sessão"}
              </Button>
            </Form>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button type="button" variant="outline" onClick={() => handleProfileOpenChange(false)}>
                Fechar
              </Button>
              <Button type="button" className="dashboard-cta" onClick={handleSaveNickname}>
                Salvar apelido
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AppLayout