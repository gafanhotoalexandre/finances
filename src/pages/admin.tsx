import * as React from "react"
import {
  ArrowLeftIcon,
  Building2Icon,
  CheckCircle2Icon,
  ChevronDownIcon,
  CopyIcon,
  HistoryIcon,
  Link2Icon,
  LoaderCircleIcon,
  SparklesIcon,
  TimerResetIcon,
  UsersIcon,
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type {
  AdminActionData,
  AdminCreatedInvite,
  AdminInviteRecord,
  AdminInviteScope,
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

const MIN_WORKSPACE_NAME_LENGTH = 3
const MAX_WORKSPACE_NAME_LENGTH = 80

const INVITE_SCOPE_OPTIONS: Array<{
  description: string
  icon: React.ComponentType<React.ComponentProps<"svg">>
  label: string
  value: AdminInviteScope
}> = [
  {
    description: "Cria um convite para abrir um workspace novo.",
    icon: Building2Icon,
    label: "Criar novo workspace",
    value: "isolated-workspace",
  },
  {
    description: "Cria um convite para o workspace que voce administra hoje.",
    icon: UsersIcon,
    label: "Adicionar ao meu workspace",
    value: "workspace-member",
  },
]

export function AdminPage() {
  const loaderData = useRouteLoaderData<AdminLoaderData>("admin")
  const actionData = useActionData() as AdminActionData | undefined
  const navigation = useNavigation()
  const submit = useSubmit()
  const [copyFeedback, setCopyFeedback] = React.useState<FeedbackState | null>(
    null
  )
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null)
  const [inviteScope, setInviteScope] = React.useState<AdminInviteScope>(
    "isolated-workspace"
  )
  const [inviteToRevoke, setInviteToRevoke] =
    React.useState<AdminInviteRecord | null>(null)
  const [workspaceName, setWorkspaceName] = React.useState("")

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
  const shouldShowWorkspaceName = inviteScope === "isolated-workspace"
  const normalizedWorkspaceName = workspaceName.trim()
  const workspaceNameLength = normalizedWorkspaceName.length
  const isWorkspaceNameInvalid =
    shouldShowWorkspaceName &&
    workspaceName.length > 0 &&
    (workspaceNameLength < MIN_WORKSPACE_NAME_LENGTH ||
      workspaceNameLength > MAX_WORKSPACE_NAME_LENGTH)
  const canCreateInvite =
    !isCreating &&
    (!shouldShowWorkspaceName ||
      (workspaceNameLength >= MIN_WORKSPACE_NAME_LENGTH &&
        workspaceNameLength <= MAX_WORKSPACE_NAME_LENGTH))

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

  function handleInviteScopeChange(nextScope: AdminInviteScope) {
    setInviteScope(nextScope)

    if (nextScope === "workspace-member") {
      setWorkspaceName("")
    }
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
                    Convites administrativos
                  </h2>
                  <Badge
                    variant="outline"
                    className="glass-card border-white/65 bg-white/72 text-[11px] tracking-[0.18em] uppercase text-slate-700 dark:border-slate-700/70 dark:bg-slate-950/60 dark:text-slate-200"
                  >
                    Admin
                  </Badge>
                </div>
                <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Crie convites para um novo workspace ou para o seu workspace
                  atual e acompanhe o historico em um unico lugar.
                </p>
              </div>
            </div>

            <Button asChild variant="outline" className="w-full sm:w-auto">
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

          <div className="lg:hidden">
            <InviteComposerPanel
              canCreateInvite={canCreateInvite}
              copiedKey={copiedKey}
              inviteScope={inviteScope}
              isCreating={isCreating}
              isWorkspaceNameInvalid={isWorkspaceNameInvalid}
              onCopyInviteLink={handleCopyInviteLink}
              onInviteScopeChange={handleInviteScopeChange}
              onWorkspaceNameChange={setWorkspaceName}
              recentInvite={recentInvite}
              shouldShowWorkspaceName={shouldShowWorkspaceName}
              workspaceName={workspaceName}
            />
          </div>

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
            <aside className="hidden min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:flex lg:self-start">
              <InviteComposerPanel
                canCreateInvite={canCreateInvite}
                copiedKey={copiedKey}
                inviteScope={inviteScope}
                isCreating={isCreating}
                isWorkspaceNameInvalid={isWorkspaceNameInvalid}
                onCopyInviteLink={handleCopyInviteLink}
                onInviteScopeChange={handleInviteScopeChange}
                onWorkspaceNameChange={setWorkspaceName}
                recentInvite={recentInvite}
                shouldShowWorkspaceName={shouldShowWorkspaceName}
                workspaceName={workspaceName}
              />
            </aside>

            <section className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-col gap-1 px-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Historico de convites
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {loaderData.invites.length} registro(s) visivel(is) para
                    este admin.
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
                      Gere o primeiro link para um novo workspace ou para o seu
                      workspace atual.
                    </CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <>
                  <div className="flex flex-col gap-3 lg:hidden">
                    {loaderData.invites.map((invite) => {
                      const showCopyAction = invite.visualStatus === "pending"
                      const showRevokeAction = invite.status === "pending"
                      const isInviteRevoking =
                        isRevoking && pendingInviteId === invite.id

                      return (
                        <details
                          key={invite.id}
                          className="group glass-card overflow-hidden rounded-[22px] border-white/55 bg-white/76 dark:border-slate-700/70 dark:bg-slate-950/55"
                        >
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden">
                            <div className="flex min-w-0 items-center gap-3">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "shrink-0 text-[11px] tracking-[0.16em] uppercase",
                                  getInviteBadgeClassName(invite.visualStatus)
                                )}
                              >
                                {getInviteStatusLabel(invite.visualStatus)}
                              </Badge>
                              <span className="min-w-0 truncate text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                                {getInviteCompactTitle(invite)}
                              </span>
                            </div>
                            <ChevronDownIcon className="size-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180 dark:text-slate-500" />
                          </summary>

                          <div className="flex flex-col gap-4 border-t border-white/60 px-4 pb-4 pt-3 dark:border-slate-700/70">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="secondary"
                                className="font-mono text-[11px] tracking-[0.18em] uppercase"
                              >
                                {invite.code}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={getInviteScopeBadgeClassName(invite.scope)}
                              >
                                {getInviteScopeLabel(invite.scope)}
                              </Badge>
                              <Badge variant="secondary">Role {invite.requestedRole}</Badge>
                            </div>

                            <div className="rounded-[20px] border border-slate-200/80 bg-white/72 px-4 py-4 text-sm text-slate-600 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.42)] dark:border-slate-700/70 dark:bg-slate-950/45 dark:text-slate-300">
                              <div className="flex flex-col gap-2">
                                <span className="text-xs font-medium tracking-[0.16em] uppercase text-slate-500 dark:text-slate-400">
                                  Detalhes do convite
                                </span>
                                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                                  {describeInviteAudience(invite)}
                                </p>
                                <div className="grid gap-1 text-sm text-slate-500 dark:text-slate-400">
                                  <span>Validade: {formatDateTime(invite.expiresAt)}</span>
                                  <span>Ativado por: {getInviteActivationLabel(invite)}</span>
                                </div>
                                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                                  {describeInviteState(invite)}
                                </p>
                              </div>
                            </div>

                            <InviteActionButtons
                              copiedKey={copiedKey}
                              invite={invite}
                              isInviteRevoking={isInviteRevoking}
                              onCopyInviteLink={handleCopyInviteLink}
                              onRequestRevoke={setInviteToRevoke}
                              showCopyAction={showCopyAction}
                              showRevokeAction={showRevokeAction}
                            />
                          </div>
                        </details>
                      )
                    })}
                  </div>

                  <div className="hidden flex-col gap-3 lg:flex">
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
                                <Badge
                                  variant="outline"
                                  className={getInviteScopeBadgeClassName(invite.scope)}
                                >
                                  {getInviteScopeLabel(invite.scope)}
                                </Badge>
                                <Badge variant="secondary">Role {invite.requestedRole}</Badge>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <span>Criado em {formatDateTime(invite.createdAt)}</span>
                                <Separator orientation="vertical" className="h-3" />
                                <span>Expira em {formatDateTime(invite.expiresAt)}</span>
                              </div>

                              <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
                                {describeInviteAudience(invite)}
                              </p>

                              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                                {describeInviteState(invite)}
                              </p>
                            </div>

                            <InviteActionButtons
                              copiedKey={copiedKey}
                              invite={invite}
                              isInviteRevoking={isInviteRevoking}
                              onCopyInviteLink={handleCopyInviteLink}
                              onRequestRevoke={setInviteToRevoke}
                              showCopyAction={showCopyAction}
                              showRevokeAction={showRevokeAction}
                              className="lg:justify-end"
                            />
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
                </>
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
                ? `O codigo ${inviteToRevoke.code} sera marcado como revoked e permanecera no historico administrativo. ${describeInviteAudience(inviteToRevoke)} Essa acao encerra o uso operacional do link e nao faz hard delete.`
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

type InviteComposerPanelProps = {
  canCreateInvite: boolean
  copiedKey: string | null
  inviteScope: AdminInviteScope
  isCreating: boolean
  isWorkspaceNameInvalid: boolean
  onCopyInviteLink: (code: string, key: string) => Promise<void>
  onInviteScopeChange: (nextScope: AdminInviteScope) => void
  onWorkspaceNameChange: (nextValue: string) => void
  recentInvite: AdminCreatedInvite | null
  shouldShowWorkspaceName: boolean
  workspaceName: string
}

function InviteComposerPanel({
  canCreateInvite,
  copiedKey,
  inviteScope,
  isCreating,
  isWorkspaceNameInvalid,
  onCopyInviteLink,
  onInviteScopeChange,
  onWorkspaceNameChange,
  recentInvite,
  shouldShowWorkspaceName,
  workspaceName,
}: InviteComposerPanelProps) {
  return (
    <Card className="glass-card rounded-[24px] border-white/55 bg-white/76 py-0 dark:border-slate-700/70 dark:bg-slate-950/55">
      <CardHeader className="px-5 pt-5">
        <Badge
          variant="outline"
          className="w-fit border-white/65 bg-white/70 text-[11px] tracking-[0.18em] uppercase dark:border-slate-700/80 dark:bg-slate-950/60"
        >
          Novo convite
        </Badge>
        <CardTitle className="pt-2">Criar convite</CardTitle>
        <CardDescription>
          Escolha o destino do convite e gere um link pronto para copiar.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-5 pb-5">
        <Form method="post" className="flex flex-col gap-4">
          <input type="hidden" name="intent" value="create-invite" />
          <FieldGroup>
            <FieldSet className="gap-4">
              <div className="flex flex-col gap-1">
                <FieldLegend>Como esse convite sera usado</FieldLegend>
                <FieldDescription>
                  Escolha como esse convite sera usado. O link sera criado no
                  dominio atual.
                </FieldDescription>
              </div>
              <div
                aria-label="Tipo de convite"
                data-slot="radio-group"
                role="radiogroup"
                className="grid gap-2.5"
              >
                {INVITE_SCOPE_OPTIONS.map((option) => {
                  const isSelected = inviteScope === option.value
                  const Icon = option.icon

                  return (
                    <label
                      key={option.value}
                      className={cn(
                        "flex min-w-0 cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3.5 transition-[background-color,border-color,box-shadow,color]",
                        isSelected
                          ? "border-slate-900 bg-slate-950/96 text-white shadow-[0_18px_28px_-24px_rgba(15,23,42,0.72)] dark:border-sky-300/60 dark:bg-slate-900 dark:text-slate-50"
                          : "border-white/65 bg-white/80 text-slate-700 hover:border-slate-300 hover:bg-white dark:border-slate-700/75 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-950/65"
                      )}
                    >
                      <input
                        checked={isSelected}
                        className="mt-1 size-4 shrink-0 accent-slate-900 dark:accent-sky-300"
                        name="inviteScope"
                        onChange={() => onInviteScopeChange(option.value)}
                        type="radio"
                        value={option.value}
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <Icon
                            className={cn(
                              "size-4 shrink-0",
                              isSelected
                                ? "text-sky-200"
                                : "text-slate-500 dark:text-slate-300"
                            )}
                          />
                          <span className="min-w-0 text-sm font-semibold tracking-tight">
                            {option.label}
                          </span>
                        </div>
                        <p
                          className={cn(
                            "min-w-0 text-sm leading-6",
                            isSelected
                              ? "text-white/82"
                              : "text-slate-600 dark:text-slate-300"
                          )}
                        >
                          {option.description}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </FieldSet>

            {shouldShowWorkspaceName ? (
              <Field data-invalid={isWorkspaceNameInvalid || undefined}>
                <FieldLabel htmlFor="workspaceName">Nome do workspace</FieldLabel>
                <Input
                  aria-invalid={isWorkspaceNameInvalid || undefined}
                  id="workspaceName"
                  maxLength={MAX_WORKSPACE_NAME_LENGTH}
                  minLength={MIN_WORKSPACE_NAME_LENGTH}
                  name="workspaceName"
                  onChange={(event) => onWorkspaceNameChange(event.target.value)}
                  placeholder="Ex: Studio Fiscal Norte"
                  required
                  value={workspaceName}
                />
                <FieldDescription>
                  Esse nome sera usado na criacao do novo workspace.
                </FieldDescription>
                {isWorkspaceNameInvalid ? (
                  <FieldError>
                    Use entre {MIN_WORKSPACE_NAME_LENGTH} e {MAX_WORKSPACE_NAME_LENGTH} caracteres para nomear o novo workspace.
                  </FieldError>
                ) : null}
              </Field>
            ) : null}
          </FieldGroup>

          <Button
            type="submit"
            size="lg"
            className="dashboard-cta w-full"
            disabled={!canCreateInvite}
          >
            {isCreating ? (
              <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
            ) : (
              <SparklesIcon data-icon="inline-start" />
            )}
            {isCreating
              ? "Gerando convite..."
              : inviteScope === "isolated-workspace"
                ? "Criar convite para novo workspace"
                : "Criar convite para meu workspace"}
          </Button>
        </Form>

        {recentInvite ? (
          <>
            <Separator />
            <div className="rounded-[20px] border border-indigo-200/70 bg-indigo-50/78 px-4 py-4 text-sm shadow-[0_18px_34px_-28px_rgba(67,56,202,0.4)] dark:border-indigo-500/25 dark:bg-indigo-500/10">
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-[11px] font-medium tracking-[0.16em] uppercase text-indigo-700 dark:text-indigo-200">
                      Ultimo convite
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-indigo-600 font-mono text-white dark:bg-indigo-500 dark:text-slate-950">
                        {recentInvite.code}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={getInviteScopeBadgeClassName(recentInvite.scope)}
                      >
                        {getInviteScopeLabel(recentInvite.scope)}
                      </Badge>
                    </div>
                  </div>
                  <span className="text-right text-xs text-indigo-700 dark:text-indigo-200">
                    Expira em {formatDate(recentInvite.expiresAt)}
                  </span>
                </div>
                <p className="text-sm leading-6 text-indigo-700 dark:text-indigo-200">
                  {describeInviteAudience(recentInvite)}
                </p>
                <Button
                  type="button"
                  className="dashboard-cta w-full sm:w-auto"
                  onClick={() => void onCopyInviteLink(recentInvite.code, recentInvite.id)}
                >
                  <CopyIcon data-icon="inline-start" />
                  {copiedKey === recentInvite.id ? "Copiado" : "Copiar link"}
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

type InviteActionButtonsProps = {
  className?: string
  copiedKey: string | null
  invite: AdminInviteRecord
  isInviteRevoking: boolean
  onCopyInviteLink: (code: string, key: string) => Promise<void>
  onRequestRevoke: (invite: AdminInviteRecord) => void
  showCopyAction: boolean
  showRevokeAction: boolean
}

function InviteActionButtons({
  className,
  copiedKey,
  invite,
  isInviteRevoking,
  onCopyInviteLink,
  onRequestRevoke,
  showCopyAction,
  showRevokeAction,
}: InviteActionButtonsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {showCopyAction ? (
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => void onCopyInviteLink(invite.code, invite.id)}
        >
          <CopyIcon data-icon="inline-start" />
          {copiedKey === invite.id ? "Copiado" : "Copiar link"}
        </Button>
      ) : null}

      {showRevokeAction ? (
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={isInviteRevoking}
          onClick={() => onRequestRevoke(invite)}
        >
          {isInviteRevoking ? (
            <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
          ) : (
            <XCircleIcon data-icon="inline-start" />
          )}
          Revogar
        </Button>
      ) : null}
    </div>
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

function describeInviteAudience(invite: {
  scope: AdminInviteScope
  workspaceName: string | null
}) {
  if (invite.scope === "isolated-workspace") {
    if (invite.workspaceName) {
      return `Cria o workspace ${invite.workspaceName} e libera acesso admin para quem ativar o convite.`
    }

    return "Cria um novo workspace e libera acesso admin para quem ativar o convite."
  }

  return "Adiciona a pessoa ao seu workspace atual com acesso de membro."
}

function getInviteCompactTitle(invite: AdminInviteRecord) {
  if (invite.scope === "isolated-workspace") {
    return invite.workspaceName ?? "Novo workspace"
  }

  if (invite.claimedByShort) {
    return `Membro ${invite.claimedByShort}`
  }

  if (invite.claimedBySnapshotShort) {
    return `Membro ${invite.claimedBySnapshotShort}`
  }

  return "Membro do workspace atual"
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

function getInviteActivationLabel(invite: AdminInviteRecord) {
  if (invite.claimedByShort) {
    return invite.claimedByShort
  }

  if (invite.claimedBySnapshotShort) {
    return invite.claimedBySnapshotShort
  }

  if (invite.visualStatus === "pending") {
    return "aguardando ativacao"
  }

  return "nao ativado"
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

function getInviteScopeBadgeClassName(scope: AdminInviteScope) {
  if (scope === "isolated-workspace") {
    return "border-sky-200/80 bg-sky-50/78 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/12 dark:text-sky-200"
  }

  return "border-slate-200/80 bg-slate-50/78 text-slate-700 dark:border-slate-700/70 dark:bg-slate-900/55 dark:text-slate-200"
}

function getInviteScopeLabel(scope: AdminInviteScope) {
  if (scope === "isolated-workspace") {
    return "Novo workspace"
  }

  return "Workspace atual"
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