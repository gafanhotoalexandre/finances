import { Outlet, useLocation } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

const copyByPath: Record<
  string,
  {
    eyebrow: string
    supporting: string
    title: string
  }
> = {
  "/login": {
    eyebrow: "Acesso ao seu espaco",
    supporting:
      "Entre com calma e retome sua rotina financeira do ponto em que parou.",
    title: "Um acesso simples, limpo e pronto para levar voce de volta ao caixa.",
  },
}

export function AuthLayout() {
  const location = useLocation()
  const copy = copyByPath[location.pathname] ?? {
    eyebrow: "Convite em andamento",
    supporting:
      "Crie sua conta, confirme os dados e entre no espaco certo sem sair desta tela.",
    title: "Seu convite ja aponta o caminho. Falta apenas concluir a entrada.",
  }

  return (
    <div className="bg-blueprint relative min-h-svh overflow-hidden">
      <div className="relative mx-auto flex min-h-svh max-w-6xl flex-col gap-8 px-6 py-8 lg:flex-row lg:items-center lg:justify-between lg:gap-14 lg:py-12">
        <section className="flex max-w-xl flex-col gap-6 lg:pr-4">
          <Badge variant="outline" className="glass-card w-fit border-white/60 bg-white/60 text-[11px] uppercase tracking-[0.22em] text-slate-700 dark:border-slate-700/70 dark:bg-slate-950/55 dark:text-slate-200">
            {copy.eyebrow}
          </Badge>
          <div className="flex flex-col gap-3">
            <h1 className="max-w-lg text-4xl leading-tight font-semibold tracking-tight text-slate-800 sm:text-5xl dark:text-slate-50">
              Project Finance
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg dark:text-slate-300">
              {copy.title}
            </p>
            <p className="max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              {copy.supporting}
            </p>
          </div>
          <Separator className="max-w-sm" />
          <div className="grid gap-4 text-sm text-muted-foreground sm:grid-cols-3">
            <div className="glass-card flex flex-col gap-1 rounded-2xl border-white/55 p-4 text-slate-600 dark:border-slate-700/70 dark:bg-slate-950/55 dark:text-slate-300">
              <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-800 dark:text-slate-100">
                Direto
              </span>
              <span>Entre com e-mail e senha sem telas paralelas.</span>
            </div>
            <div className="glass-card flex flex-col gap-1 rounded-2xl border-white/55 p-4 text-slate-600 dark:border-slate-700/70 dark:bg-slate-950/55 dark:text-slate-300">
              <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-800 dark:text-slate-100">
                Guiado
              </span>
              <span>Login e convite deixam claro o proximo passo.</span>
            </div>
            <div className="glass-card flex flex-col gap-1 rounded-2xl border-white/55 p-4 text-slate-600 dark:border-slate-700/70 dark:bg-slate-950/55 dark:text-slate-300">
              <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-800 dark:text-slate-100">
                Pronto
              </span>
              <span>Ao final, seu espaco ja abre no contexto correto.</span>
            </div>
          </div>
        </section>
        <section className="w-full max-w-md lg:max-w-lg">
          <Outlet />
        </section>
      </div>
    </div>
  )
}

export default AuthLayout