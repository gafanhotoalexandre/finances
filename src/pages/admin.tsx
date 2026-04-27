import * as React from "react"
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  CopyIcon,
  HistoryIcon,
  Link2Icon,
  LoaderCircleIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TimerResetIcon,
  XCircleIcon,
} from "lucide-react"
import {
  Form,
  Link,
  useActionData,
  useNavigation,
  useRouteLoaderData,
  useSubmit,
} from "react-router"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type {
  AdminActionData,
  AdminInviteRecord,
  AdminLoaderData,
} from "@/routes/data"

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
})

const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
})

type FeedbackState = {
  kind: "error" | "success"
  message: string
}

type InviteMetricCardProps = {
  accentClassName: string
  icon: React.ComponentType<React.ComponentProps<"svg">>
  label: string
  value: number
}

export function AdminPage() {
  const loaderData = useRouteLoaderData<AdminLoaderData>("admin")
  const actionData = useActionData() as AdminActionData | undefined
  const navigation = useNavigation()
  const submit = useSubmit()
  const [copyFeedback, setCopyFeedback] = React.useState<FeedbackState | null>(
    null
  )
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null)
  const [inviteToRevoke, setInviteToRevoke] =
    React.useState<AdminInviteRecord | null>(null)

  if (!loaderData) {
    throw new Error("ADMIN_LOADER_MISSING")
  }

  const pendingIntent =
    navigation.state === "submitting"
      ? String(navigation.formData?.get("intent") ?? "")
      : null
  const pendingInviteId =
    navigation.state === "submitting"
      ? String(navigation.formData?.get("inviteId") ?? "")
      : null
  const isCreating = pendingIntent === "create-invite"
  const isRevoking = pendingIntent === "revoke-invite"

  const metrics = countInvitesByVisualStatus(loaderData.invites)
  const recentInvite = actionData?.createdInvite ?? null
  const feedback = resolveFeedback(actionData, copyFeedback)

  React.useEffect(() => {
    if (!copiedKey) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setCopiedKey(null)
    }, 1600)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [copiedKey])

  async function handleCopyInviteLink(code: string, key: string) {
    try {
      await navigator.clipboard.writeText(buildInviteUrl(code))
      setCopiedKey(key)
      setCopyFeedback({
        kind: "success",
        message: "Link completo copiado com o dominio atual.",
      })
    } catch {
      setCopyFeedback({
        kind: "error",
        message: "Nao foi possivel copiar o link agora.",
      })
    }
  }

  function handleConfirmRevoke() {
    if (!inviteToRevoke) {
      return
    }

    const currentInviteId = inviteToRevoke.id
    const formData = new FormData()
    formData.set("intent", "revoke-invite")
    formData.set("inviteId", currentInviteId)
    submit(formData, { method: "post" })
    setInviteToRevoke(null)
  }

  return (
    <>
      <section className="w-full min-w-0 rounded-[28px] py-4">
        <div className="flex flex-col gap-6 lg:gap-7">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] font-medium tracking-[0.24em] uppercase text-slate-500 dark:text-slate-400">
                Controle administrativo
              </span>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-800 sm:text-3xl dark:text-slate-50">
                    Convites do workspace
                  </h2>
                  <Badge
                    variant="outline"
                    className="border-indigo-200/80 bg-indigo-50/78 text-[11px] tracking-[0.18em] uppercase text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/12 dark:text-indigo-200"
                  >
                    v0.2 admin
                  </Badge>
                </div>
                <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Gere links no formato FIN-AAAA-XXXX, copie a URL completa no
                  dominio atual e acompanhe o historico real sem perder leitura
                  quando um convite expira ou e revogado.
                </p>
              </div>
            </div>

            <Button asChild variant="outline">
              <Link to="/dashboard">
                <ArrowLeftIcon data-icon="inline-start" />
                Voltar ao dashboard
              </Link>
            </Button>
          </header>

          {feedback ? (
            <div
              className={cn(
                "rounded-2xl border px-4 py-3 text-sm shadow-[0_12px_28px_-24px_rgba(15,23,42,0.45)]",
                feedback.kind === "error"
                  ? "border-rose-200/80 bg-rose-50/82 text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/25 dark:text-rose-200"
                  : "border-emerald-200/80 bg-emerald-50/82 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/25 dark:text-emerald-200"
              )}
            >
              {feedback.message}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-4 md:gap-4">
            <InviteMetricCard
              accentClassName="bg-slate-200/80 text-slate-600 dark:bg-slate-800/80 dark:text-slate-200"
              icon={TimerResetIcon}
              label="Pendentes"
              value={metrics.pending}
            />
            <InviteMetricCard
              accentClassName="bg-indigo-100/80 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-200"
              icon={HistoryIcon}
              label="Expirados"
              value={metrics.expired}
            />
            <InviteMetricCard
              accentClassName="bg-emerald-100/80 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-200"
              icon={CheckCircle2Icon}
              label="Usados"
              value={metrics.used}
            />
            <InviteMetricCard
              accentClassName="bg-rose-100/80 text-rose-600 dark:bg-rose-500/15 dark:text-rose-200"
              icon={XCircleIcon}
              label="Revogados"
              value={metrics.revoked}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-8">
            <aside className="flex min-w-0 flex-col gap-4">
              <Card className="glass-card rounded-[24px] border-white/55 bg-white/76 py-0 dark:border-slate-700/70 dark:bg-slate-950/55">
                <CardHeader className="px-5 pt-5">
                  <Badge
                    variant="outline"
                    className="w-fit border-white/65 bg-white/70 text-[11px] tracking-[0.18em] uppercase dark:border-slate-700/80 dark:bg-slate-950/60"
                  >
                    Emissao
                  </Badge>
                  <CardTitle className="pt-2">Gerar novo convite</CardTitle>
                  <CardDescription>
                    Nesta fase, todos os convites criados aqui saem com role
                    fixa de user, prazo padrao do banco e codigo protegido por
                    retry automatico em caso de colisao 23505.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 px-5 pb-5">
                  <div className="grid gap-3">
                    <div className="rounded-2xl border border-white/60 bg-white/72 px-4 py-3 text-sm text-slate-600 dark:border-slate-700/70 dark:bg-slate-950/52 dark:text-slate-300">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-100">
                        <ShieldCheckIcon className="size-4" />
                        <span className="font-medium">Link pronto para copia</span>
                      </div>
                      <p className="pt-1 leading-6">
                        O botao de copia sempre monta a URL com
                        window.location.origin no navegador atual.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-dashed border-slate-300/80 bg-slate-50/74 px-4 py-3 text-sm text-slate-600 dark:border-slate-700/70 dark:bg-slate-900/44 dark:text-slate-300">
                      Convites visualmente expirados continuam listados como
                      historico. Se ainda estiverem pending no banco, a revogacao
                      continua disponivel para fechar o registro.
                    </div>
                  </div>

                  <Form method="post" className="flex flex-col gap-3">
                    <input type="hidden" name="intent" value="create-invite" />
                    <Button
                      type="submit"
                      className="dashboard-cta w-full"
                      disabled={isCreating}
                    >
                      {isCreating ? (
                        <LoaderCircleIcon
                          data-icon="inline-start"
                          className="animate-spin"
                        />
                      ) : (
                        <SparklesIcon data-icon="inline-start" />
                      )}
                      {isCreating ? "Gerando convite..." : "Gerar convite user"}
                    </Button>
                  </Form>

                  {recentInvite ? (
                    <>
                      <Separator />
                      <div className="rounded-[22px] border border-indigo-200/70 bg-indigo-50/78 p-4 text-sm shadow-[0_18px_34px_-28px_rgba(67,56,202,0.4)] dark:border-indigo-500/25 dark:bg-indigo-500/10">
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className="bg-indigo-600 text-white dark:bg-indigo-500 dark:text-slate-950">
                                Novo convite
                              </Badge>
                              <span className="font-mono text-xs tracking-[0.18em] text-indigo-700 uppercase dark:text-indigo-200">
                                {recentInvite.code}
                              </span>
                            </div>
                            <span className="text-xs text-indigo-700 dark:text-indigo-200">
                              Expira em {formatDate(recentInvite.expiresAt)}
                            </span>
                          </div>
                          <p className="truncate font-mono text-xs text-indigo-700 dark:text-indigo-200">
                            {buildInviteUrl(recentInvite.code)}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              void handleCopyInviteLink(
                                recentInvite.code,
                                recentInvite.id
                              )
                            }
                          >
                            <CopyIcon data-icon="inline-start" />
                            {copiedKey === recentInvite.id
                              ? "Copiado"
                              : "Copiar link completo"}
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : null}
                </CardContent>
              </Card>
            </aside>

            <section className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-col gap-1 px-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Historico de convites
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {loaderData.invites.length} registro(s) lido(s) no workspace
                    atual.
                  </p>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Workspace atual: <span className="font-mono">{loaderData.workspaceId}</span>
                </div>
              </div>

              {loaderData.invites.length === 0 ? (
                <Card className="glass-card rounded-[24px] border-white/55 bg-white/74 py-0 dark:border-slate-700/70 dark:bg-slate-950/55">
                  <CardHeader className="px-5 pt-5">
                    <CardTitle>Nenhum convite emitido ainda.</CardTitle>
                    <CardDescription>
                      Gere o primeiro link neste workspace para inaugurar o fluxo
                      admin - convite - ativacao - dashboard.
                    </CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <div className="flex flex-col gap-3">
                  {loaderData.invites.map((invite) => {
                    const showCopyAction = invite.visualStatus === "pending"
                    const showRevokeAction = invite.status === "pending"
                    const isInviteRevoking =
                      isRevoking && pendingInviteId === invite.id

                    return (
                      <article
                        key={invite.id}
                        className="glass-card flex flex-col gap-4 rounded-[22px] border-white/55 px-4 py-4 dark:border-slate-700/70 dark:bg-slate-950/55"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex min-w-0 flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[11px] tracking-[0.16em] uppercase",
                                  getInviteBadgeClassName(invite.visualStatus)
                                )}
                              >
                                {getInviteStatusLabel(invite.visualStatus)}
                              </Badge>
                              <Badge
                                variant="secondary"
                                className="font-mono text-[11px] tracking-[0.18em] uppercase"
                              >
                                {invite.code}
                              </Badge>
                              <Badge variant="secondary">Role {invite.requestedRole}</Badge>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              <span>Criado em {formatDateTime(invite.createdAt)}</span>
                              <Separator orientation="vertical" className="h-3" />
                              <span>Expira em {formatDateTime(invite.expiresAt)}</span>
                            </div>

                            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                              {describeInviteState(invite)}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                            {showCopyAction ? (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  void handleCopyInviteLink(invite.code, invite.id)
                                }
                              >
                                <CopyIcon data-icon="inline-start" />
                                {copiedKey === invite.id
                                  ? "Copiado"
                                  : "Copiar link"}
                              </Button>
                            ) : null}

                            {showRevokeAction ? (
                              <Button
                                type="button"
                                variant="outline"
                                disabled={isInviteRevoking}
                                onClick={() => setInviteToRevoke(invite)}
                              >
                                {isInviteRevoking ? (
                                  <LoaderCircleIcon
                                    data-icon="inline-start"
                                    className="animate-spin"
                                  />
                                ) : (
                                  <XCircleIcon data-icon="inline-start" />
                                )}
                                Revogar
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200/80 bg-white/72 px-4 py-3 text-xs leading-6 text-slate-500 dark:border-slate-700/70 dark:bg-slate-950/52 dark:text-slate-400">
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            URL de ativacao:
                          </span>{" "}
                          <span className="font-mono">{buildInviteUrl(invite.code)}</span>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </section>

      <AlertDialog
        open={Boolean(inviteToRevoke)}
        onOpenChange={(open) => {
          if (!open) {
            setInviteToRevoke(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
              <XCircleIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>Revogar este convite?</AlertDialogTitle>
            <AlertDialogDescription>
              {inviteToRevoke
                ? `O codigo ${inviteToRevoke.code} sera marcado como revoked e permanecera no historico do workspace. Essa acao encerra o uso operacional do link e nao faz hard delete.`
                : "Confirme a revogacao deste convite."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isRevoking}
              onClick={handleConfirmRevoke}
            >
              {isRevoking ? (
                <LoaderCircleIcon
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <Link2Icon data-icon="inline-start" />
              )}
              {isRevoking ? "Revogando..." : "Confirmar revogacao"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function InviteMetricCard({
  accentClassName,
  icon: Icon,
  label,
  value,
}: InviteMetricCardProps) {
  return (
    <Card className="glass-card rounded-[22px] border-white/55 bg-white/72 py-0 dark:border-slate-700/70 dark:bg-slate-950/55">
      <CardContent className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex min-w-0 flex-col gap-3">
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-500 dark:text-slate-400">
            {label}
          </span>
          <span className="font-mono text-lg font-semibold tracking-tight text-slate-800 sm:text-2xl dark:text-slate-50">
            {value}
          </span>
        </div>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            accentClassName
          )}
        >
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  )
}

function buildInviteUrl(code: string) {
  const invitePath = `/invite/${code}`

  if (typeof window === "undefined") {
    return invitePath
  }

  return new URL(invitePath, window.location.origin).toString()
}

function countInvitesByVisualStatus(invites: AdminInviteRecord[]) {
  return invites.reduce(
    (counts, invite) => {
      counts[invite.visualStatus] += 1
      return counts
    },
    {
      expired: 0,
      pending: 0,
      revoked: 0,
      used: 0,
    }
  )
}

function describeInviteState(invite: AdminInviteRecord) {
  if (invite.status === "revoked") {
    if (invite.claimedBySnapshotShort && invite.claimedAtSnapshot) {
      return `Revogado em ${formatDateTime(invite.revokedAt)}. Historico preservado: ativado por ${invite.claimedBySnapshotShort} em ${formatDateTime(invite.claimedAtSnapshot)}.`
    }

    return `Revogado em ${formatDateTime(invite.revokedAt)} antes de qualquer ativacao.`
  }

  if (invite.visualStatus === "used") {
    return `Ativado por ${invite.claimedByShort ?? "identificador indisponivel"} em ${formatDateTime(invite.claimedAt ?? invite.claimedAtSnapshot)}.`
  }

  if (invite.visualStatus === "expired") {
    return `Prazo encerrado em ${formatDateTime(invite.expiresAt)}. A leitura visual marca este convite como expirado, mesmo que o banco ainda o mantenha pending ate nova acao operacional.`
  }

  return `Aguardando ativacao. O link continua valido ate ${formatDateTime(invite.expiresAt)}.`
}

function formatDate(value: string | null) {
  if (!value) {
    return "data indisponivel"
  }

  return DATE_FORMATTER.format(new Date(value))
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "data indisponivel"
  }

  return DATE_TIME_FORMATTER.format(new Date(value))
}

function getInviteBadgeClassName(status: AdminInviteRecord["visualStatus"]) {
  if (status === "used") {
    return "border-emerald-200/80 bg-emerald-50/78 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/12 dark:text-emerald-200"
  }

  if (status === "expired") {
    return "border-indigo-200/80 bg-indigo-50/78 text-indigo-700 dark:border-indigo-500/25 dark:bg-indigo-500/12 dark:text-indigo-200"
  }

  if (status === "revoked") {
    return "border-rose-200/80 bg-rose-50/78 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/12 dark:text-rose-200"
  }

  return "border-slate-200/80 bg-white/78 text-slate-700 dark:border-slate-700/70 dark:bg-slate-950/55 dark:text-slate-200"
}

function getInviteStatusLabel(status: AdminInviteRecord["visualStatus"]) {
  if (status === "used") {
    return "Usado"
  }

  if (status === "expired") {
    return "Expirado"
  }

  if (status === "revoked") {
    return "Revogado"
  }

  return "Pendente"
}

function resolveFeedback(
  actionData: AdminActionData | undefined,
  copyFeedback: FeedbackState | null
) {
  if (copyFeedback) {
    return copyFeedback
  }

  if (actionData?.error) {
    return {
      kind: "error",
      message: actionData.error,
    } satisfies FeedbackState
  }

  if (actionData?.info) {
    return {
      kind: "success",
      message: actionData.info,
    } satisfies FeedbackState
  }

  return null
}

export default AdminPage