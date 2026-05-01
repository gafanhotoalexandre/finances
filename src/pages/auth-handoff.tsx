import * as React from "react"
import { LoaderCircleIcon } from "lucide-react"
import { useNavigate, useSearchParams } from "react-router"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { applyAuthSnapshot, getBrowserAuthSnapshot } from "@/lib/auth"
import {
  normalizeSessionHandoffTarget,
  parseSessionHandoffIntent,
  type SessionHandoffIntent,
} from "@/lib/session-handoff"

const HANDOFF_REDIRECT_DELAY_MS = 180

const COPY_BY_INTENT: Record<
  SessionHandoffIntent,
  {
    description: string
    eyebrow: string
    progressDescription: string
    progressTitle: string
    title: string
  }
> = {
  invite: {
    description:
      "Seu convite já foi aceito. Estamos encaixando sua sessão no espaço correto antes de abrir o painel.",
    eyebrow: "Convite confirmado",
    progressDescription:
      "A tela seguinte já vai abrir com o contexto certo, sem pular por estados intermediários.",
    progressTitle: "Liberando seu acesso",
    title: "Agora estamos concluindo sua entrada.",
  },
  login: {
    description:
      "Sua autenticação foi recebida. Estamos confirmando o contexto do seu espaço antes de abrir a área protegida.",
    eyebrow: "Sessão iniciada",
    progressDescription:
      "Assim que o contexto ficar pronto, você segue direto para o painel.",
    progressTitle: "Preparando seu painel",
    title: "Sua entrada foi aceita. Falta só um instante.",
  },
  logout: {
    description:
      "Sua sessão está sendo encerrada com segurança antes de devolver você para a tela de acesso.",
    eyebrow: "Saída em andamento",
    progressDescription:
      "Estamos limpando seu contexto local para evitar retornos a estados antigos.",
    progressTitle: "Fechando sua sessão",
    title: "Estamos encerrando sua sessão agora.",
  },
}

export function AuthHandoffPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const intent = parseSessionHandoffIntent(searchParams.get("intent"))
  const target = normalizeSessionHandoffTarget(searchParams.get("to"))
  const copy = COPY_BY_INTENT[intent]

  React.useEffect(() => {
    let cancelled = false
    let timeoutId: number | null = null

    async function completeHandoff() {
      if (intent !== "logout") {
        try {
          const snapshot = await getBrowserAuthSnapshot()

          if (cancelled) {
            return
          }

          applyAuthSnapshot(snapshot)
        } catch {
          if (cancelled) {
            return
          }
        }
      }

      timeoutId = window.setTimeout(() => {
        navigate(target, { replace: true })
      }, HANDOFF_REDIRECT_DELAY_MS)
    }

    void completeHandoff()

    return () => {
      cancelled = true

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [intent, navigate, target])

  return (
    <Card className="glass-card rounded-[28px] border-white/55 bg-white/84 py-0 shadow-[0_24px_64px_-32px_rgba(15,23,42,0.45)] dark:border-slate-700/70 dark:bg-slate-950/60">
      <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
        <Badge
          variant="outline"
          className="w-fit border-slate-200/90 bg-slate-50/85 text-slate-700 dark:border-slate-700/70 dark:bg-slate-950/55 dark:text-slate-200"
        >
          {copy.eyebrow}
        </Badge>
        <CardTitle className="pt-2 text-lg text-slate-800 sm:text-xl dark:text-slate-100">
          {copy.title}
        </CardTitle>
        <CardDescription className="text-slate-600 dark:text-slate-300">
          {copy.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="flex items-center gap-3 rounded-[22px] border border-slate-200/80 bg-white/74 px-4 py-4 dark:border-slate-700/70 dark:bg-slate-950/55">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            <LoaderCircleIcon className="size-4 animate-spin" />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">
              {copy.progressTitle}
            </span>
            <span className="text-sm leading-6 text-slate-600 dark:text-slate-300">
              {copy.progressDescription}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default AuthHandoffPage