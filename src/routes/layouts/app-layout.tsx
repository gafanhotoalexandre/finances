import { Form, NavLink, Outlet, useNavigation } from "react-router"
import { ShieldCheckIcon, TerminalSquareIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { APP_VERSION } from "@/lib/app-meta"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/auth"

export function AppLayout() {
  const navigation = useNavigation()
  const session = useAuthStore((state) => state.session)
  const role = useAuthStore((state) => state.role)
  const workspaceId = useAuthStore((state) => state.workspaceId)
  const isSigningOut =
    navigation.state === "submitting" &&
    navigation.formMethod?.toLowerCase() === "post" &&
    navigation.formAction?.endsWith("/dashboard/sign-out")

  return (
    <div className="bg-blueprint relative min-h-svh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.07),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.08),transparent_28%)]" />
      <header className="relative z-10 px-3 pt-3 sm:px-6 lg:px-8 lg:pt-6">
        <div className="glass-card mx-auto flex w-full max-w-6xl flex-col gap-3 rounded-[24px] border-white/55 px-4 py-4 dark:border-slate-700/70 dark:bg-slate-950/55 sm:gap-4 sm:px-5 sm:py-5 lg:rounded-[28px] lg:flex-row lg:items-center lg:justify-between">
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
              <Badge variant="outline" className="border-white/60 bg-white/55 text-[11px] tracking-[0.22em] uppercase dark:border-slate-700/70 dark:bg-slate-950/55">
                v{APP_VERSION}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300 sm:text-sm">
              <span className="max-w-full truncate sm:max-w-none">
                {session?.user.email ?? "Sessao sem e-mail"}
              </span>
              <Separator orientation="vertical" className="hidden h-4 sm:block" />
              <span className="font-mono uppercase">{role ?? "sem role"}</span>
              <Separator orientation="vertical" className="hidden h-4 sm:block" />
              <span className="font-mono text-xs">{workspaceId ?? "sem workspace"}</span>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 self-start lg:w-auto lg:self-center">
            {role === "admin" ? (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  cn(
                    "inline-flex h-8 items-center rounded-2xl border px-3 text-[10px] font-medium tracking-[0.18em] uppercase transition-colors sm:h-9 sm:px-4 sm:text-[11px]",
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                      : "border-white/60 bg-white/55 text-slate-700 hover:bg-white/78 dark:border-slate-700/70 dark:bg-slate-950/55 dark:text-slate-200 dark:hover:bg-slate-900/80"
                  )
                }
              >
                Admin
              </NavLink>
            ) : null}
            <div className="hidden items-center gap-2 rounded-2xl border border-white/60 bg-white/50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700/70 dark:bg-slate-950/55 dark:text-slate-300 sm:flex">
              <ShieldCheckIcon className="size-4 text-emerald-600 dark:text-emerald-300" />
              RLS e contexto ativos
            </div>
            <Form method="post" action="/dashboard/sign-out">
              <Button
                variant="outline"
                type="submit"
                disabled={isSigningOut}
                className="h-8 px-3 sm:h-9 sm:px-4"
              >
                {isSigningOut ? "Saindo..." : "Sair"}
              </Button>
            </Form>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout