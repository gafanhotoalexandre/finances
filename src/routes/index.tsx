/* eslint-disable react-refresh/only-export-components */
import { TerminalSquareIcon } from "lucide-react"
import { createBrowserRouter } from "react-router"

import App from "@/App"
import AdminPage from "@/pages/admin"
import AuthHandoffPage from "@/pages/auth-handoff"
import DashboardPage from "@/pages/dashboard"
import InviteActivatePage from "@/pages/invite-activate"
import LoginPage from "@/pages/login"
import ReservesPage from "@/pages/reserves"
import NotFoundPage from "@/pages/not-found"
import RouteErrorPage from "@/pages/route-error"
import AppLayout from "@/routes/layouts/app-layout"
import AuthLayout from "@/routes/layouts/auth-layout"
import {
  adminAction,
  adminLoader,
  dashboardLoader,
  indexLoader,
  inviteAction,
  inviteLoader,
  loginAction,
  loginLoader,
  reservesLoader,
  rootLoader,
  signOutAction,
} from "@/routes/data"

export function HydrateFallback() {
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-slate-50 px-6 py-10 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.16),transparent_30%)]" />
      <div
        aria-live="polite"
        className="glass-card relative flex w-full max-w-sm flex-col items-center gap-5 rounded-[32px] border border-white/65 bg-white/80 px-8 py-10 text-center shadow-[0_32px_80px_-44px_rgba(15,23,42,0.52)] dark:border-slate-700/70 dark:bg-slate-950/72"
        role="status"
      >
        <div className="flex size-18 items-center justify-center rounded-[28px] border border-sky-200/80 bg-linear-to-br from-white via-sky-50 to-cyan-100 text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_22px_40px_-26px_rgba(14,165,233,0.7)] dark:border-sky-400/20 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/60 dark:text-sky-100">
          <TerminalSquareIcon className="size-8 animate-pulse" />
        </div>
        <div className="space-y-2">
          <span className="block font-mono text-[11px] font-medium tracking-[0.34em] uppercase text-slate-500 dark:text-slate-400">
            SYS::FINANCE
          </span>
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            Carregando aplicação...
          </p>
        </div>
      </div>
    </div>
  )
}

export const router = createBrowserRouter([
  {
    id: "root",
    path: "/",
    loader: rootLoader,
    Component: App,
    HydrateFallback,
    errorElement: <RouteErrorPage />,
    children: [
      {
        index: true,
        loader: indexLoader,
      },
      {
        Component: AuthLayout,
        children: [
          {
            path: "login",
            loader: loginLoader,
            action: loginAction,
            Component: LoginPage,
          },
          {
            path: "handoff",
            Component: AuthHandoffPage,
          },
          {
            path: "invite/:code",
            loader: inviteLoader,
            action: inviteAction,
            Component: InviteActivatePage,
          },
        ],
      },
      {
        id: "dashboard",
        path: "dashboard",
        loader: dashboardLoader,
        Component: AppLayout,
        children: [
          {
            index: true,
            Component: DashboardPage,
          },
          {
            path: "sign-out",
            action: signOutAction,
          },
        ],
      },
      {
        path: "reservas",
        Component: AppLayout,
        children: [
          {
            id: "reserves",
            index: true,
            loader: reservesLoader,
            Component: ReservesPage,
          },
        ],
      },
      {
        path: "admin",
        Component: AppLayout,
        children: [
          {
            id: "admin",
            index: true,
            loader: adminLoader,
            action: adminAction,
            Component: AdminPage,
          },
        ],
      },
      {
        path: "*",
        Component: NotFoundPage,
      },
    ],
  },
])