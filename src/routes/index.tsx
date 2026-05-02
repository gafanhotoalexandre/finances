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

export const router = createBrowserRouter([
  {
    id: "root",
    path: "/",
    loader: rootLoader,
    Component: App,
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