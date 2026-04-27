import { createBrowserRouter } from "react-router"

import App from "@/App"
import DashboardPage from "@/pages/dashboard"
import InviteActivatePage from "@/pages/invite-activate"
import LoginPage from "@/pages/login"
import NotFoundPage from "@/pages/not-found"
import RouteErrorPage from "@/pages/route-error"
import AppLayout from "@/routes/layouts/app-layout"
import AuthLayout from "@/routes/layouts/auth-layout"
import {
  dashboardLoader,
  indexLoader,
  inviteAction,
  inviteLoader,
  loginAction,
  loginLoader,
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
        path: "*",
        Component: NotFoundPage,
      },
    ],
  },
])