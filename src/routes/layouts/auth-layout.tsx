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
    title: "Um acesso simples, limpo e pronto para levar você de volta ao caixa.",
  },
  "/handoff": {
    eyebrow: "Transição segura",
    supporting:
      "Estamos confirmando sua sessão e preparando o próximo passo sem te devolver para um estado intermediário.",
    title: "Seu acesso está mudando de etapa. Falta só um instante.",
  },
}

export function AuthLayout() {
  const location = useLocation()
  const copy = copyByPath[location.pathname] ?? {
    eyebrow: "Convite em andamento",
    supporting:
      "Crie sua conta, confirme os dados e entre no espaço certo sem sair desta tela.",
    title: "Seu convite já aponta o caminho. Falta apenas concluir a entrada.",
  }

  return (
    <div className="bg-blueprint relative min-h-svh overflow-hidden">
      <div className="relative mx-auto flex min-h-svh max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-8 lg:flex-row lg:items-center lg:justify-between lg:gap-14 lg:py-12">
        <section className="order-1 w-full max-w-md lg:order-2 lg:max-w-lg">
          <Outlet />
        </section>

        <section className="order-2 flex max-w-xl flex-col gap-4 lg:order-1 lg:gap-6 lg:pr-4">
          <div className="glass-card flex flex-col gap-2 rounded-[24px] border-white/55 px-4 py-4 text-slate-600 dark:border-slate-700/70 dark:bg-slate-950/55 dark:text-slate-300 lg:hidden">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-white/60 bg-white/70 text-[11px] uppercase tracking-[0.22em] text-slate-700 dark:border-slate-700/70 dark:bg-slate-950/60 dark:text-slate-200">
                {copy.eyebrow}
              </Badge>
              <span className="font-mono text-[10px] font-medium tracking-[0.24em] uppercase text-slate-500 dark:text-slate-400">
                Project Finance
              </span>
            </div>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
              {copy.title}
            </p>
            <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
              {copy.supporting}
            </p>
          </div>

          <Badge variant="outline" className="glass-card hidden w-fit border-white/60 bg-white/60 text-[11px] uppercase tracking-[0.22em] text-slate-700 dark:border-slate-700/70 dark:bg-slate-950/55 dark:text-slate-200 lg:inline-flex">
            {copy.eyebrow}
          </Badge>

          <div className="hidden flex-col gap-3 lg:flex">
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

          <Separator className="hidden max-w-sm lg:block" />

          <div className="hidden gap-4 text-sm text-muted-foreground sm:grid-cols-3 lg:grid">
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
              <span>Login e convite deixam claro o próximo passo.</span>
            </div>
            <div className="glass-card flex flex-col gap-1 rounded-2xl border-white/55 p-4 text-slate-600 dark:border-slate-700/70 dark:bg-slate-950/55 dark:text-slate-300">
              <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-800 dark:text-slate-100">
                Pronto
              </span>
              <span>Ao final, seu espaço já abre no contexto correto.</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default AuthLayout