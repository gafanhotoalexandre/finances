import * as React from "react"
import { useRevalidator, useRouteLoaderData } from "react-router"
import {
  ArrowUpRightIcon,
  CalendarDaysIcon,
  Clock3Icon,
  LoaderCircleIcon,
  PlusIcon,
  WalletIcon,
} from "lucide-react"

import { getFriendlyErrorMessage } from "@/lib/auth"
import {
  allocateToReserve,
  createReserve,
  getCurrentOccurredOn,
  type ReserveSummary,
} from "@/lib/finance"
import { cn } from "@/lib/utils"
import type { ReservesLoaderData } from "@/routes/data"
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
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type FeedbackState = {
  kind: "error" | "success"
  message: string
}

type CreateReserveFormState = {
  name: string
  targetAmount: string
}

type ReserveAllocationFormState = {
  amount: string
  description: string
  occurredOn: string
}

type MetricAccent = "emerald" | "sky" | "slate"

const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
})

const OCCURRED_ON_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
})

export function ReservesPage() {
  const loaderData = useRouteLoaderData<ReservesLoaderData>("reserves")

  if (!loaderData) {
    throw new Error("RESERVES_LOADER_MISSING")
  }

  const workspaceId = loaderData.workspaceId

  const revalidator = useRevalidator()
  const [feedback, setFeedback] = React.useState<FeedbackState | null>(null)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [allocationError, setAllocationError] = React.useState<string | null>(
    null
  )
  const [createFormState, setCreateFormState] = React.useState(
    createReserveFormState
  )
  const [allocationFormState, setAllocationFormState] = React.useState(
    createReserveAllocationFormState
  )
  const [selectedReserveId, setSelectedReserveId] = React.useState<string | null>(
    null
  )
  const [allocationDrawerOpen, setAllocationDrawerOpen] = React.useState(false)
  const [isCreating, setIsCreating] = React.useState(false)
  const [isAllocating, setIsAllocating] = React.useState(false)

  const selectedReserve =
    loaderData.reserves.find((reserve) => reserve.id === selectedReserveId) ?? null
  const totalSaved = loaderData.reserves.reduce(
    (sum, reserve) => sum + reserve.currentAmount,
    0
  )
  const trackedTargets = loaderData.reserves.filter(
    (reserve) => reserve.targetAmount !== null
  )
  const completedTargets = trackedTargets.filter(
    (reserve) => (reserve.remainingAmount ?? 0) <= 0
  )
  const lastContributionOn = loaderData.reserves.reduce<string | null>(
    (latest, reserve) => {
      if (!reserve.lastEntryOn) {
        return latest
      }

      if (!latest || reserve.lastEntryOn > latest) {
        return reserve.lastEntryOn
      }

      return latest
    },
    null
  )
  const isRevalidating = revalidator.state !== "idle"
  const canCreateReserve =
    !isCreating &&
    createFormState.name.trim().length >= 2 &&
    isOptionalPositiveAmountInput(createFormState.targetAmount)
  const canAllocate =
    !isAllocating &&
    selectedReserve !== null &&
    isPositiveAmountInput(allocationFormState.amount) &&
    allocationFormState.description.trim().length >= 3 &&
    allocationFormState.occurredOn.trim().length > 0

  function updateCreateFormField<Key extends keyof CreateReserveFormState>(
    field: Key,
    value: CreateReserveFormState[Key]
  ) {
    setCreateError(null)
    setCreateFormState((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updateAllocationFormField<
    Key extends keyof ReserveAllocationFormState,
  >(field: Key, value: ReserveAllocationFormState[Key]) {
    setAllocationError(null)
    setAllocationFormState((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handleAllocationDrawerOpenChange(open: boolean) {
    setAllocationDrawerOpen(open)

    if (!open) {
      setSelectedReserveId(null)
      setAllocationError(null)
      setAllocationFormState(createReserveAllocationFormState())
    }
  }

  function openAllocationDrawer(reserve: ReserveSummary) {
    setFeedback(null)
    setAllocationError(null)
    setSelectedReserveId(reserve.id)
    setAllocationFormState(createReserveAllocationFormState(reserve.name))
    setAllocationDrawerOpen(true)
  }

  async function handleCreateReserve(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)
    setCreateError(null)
    setIsCreating(true)

    try {
      const reserveName = createFormState.name.trim()

      await createReserve({
        name: reserveName,
        targetAmount: parseOptionalPositiveAmount(createFormState.targetAmount),
        workspaceId,
      })

      setFeedback({
        kind: "success",
        message: `Caixinha "${reserveName}" criada com sucesso.`,
      })
      setCreateFormState(createReserveFormState())
      React.startTransition(() => {
        revalidator.revalidate()
      })
    } catch (error) {
      setCreateError(
        getReserveFriendlyMessage(
          error,
          "Não foi possível criar a nova reserva agora."
        )
      )
    } finally {
      setIsCreating(false)
    }
  }

  async function handleAllocateReserve(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedReserve) {
      return
    }

    setFeedback(null)
    setAllocationError(null)
    setIsAllocating(true)

    try {
      const reserveName = selectedReserve.name

      await allocateToReserve({
        amount: parsePositiveAmount(allocationFormState.amount),
        description: allocationFormState.description,
        occurredOn: allocationFormState.occurredOn,
        reserveId: selectedReserve.id,
      })

      setFeedback({
        kind: "success",
        message: `${formatCurrency(parsePositiveAmount(allocationFormState.amount))} guardado em "${reserveName}" com sucesso.`,
      })
      handleAllocationDrawerOpenChange(false)
      React.startTransition(() => {
        revalidator.revalidate()
      })
    } catch (error) {
      setAllocationError(
        getReserveFriendlyMessage(
          error,
          "Não foi possível guardar esse dinheiro agora."
        )
      )
    } finally {
      setIsAllocating(false)
    }
  }

  return (
    <>
      <section className="w-full min-w-0 rounded-[28px] py-4">
        <div className="flex flex-col gap-5 lg:gap-6">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] font-medium tracking-[0.24em] uppercase text-slate-500 dark:text-slate-400">
                Reserva estratégica
              </span>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-800 sm:text-3xl dark:text-slate-50">
                    O Cofre
                  </h2>
                  <Badge
                    variant="outline"
                    className="glass-card border-white/65 bg-white/72 text-[11px] tracking-[0.18em] uppercase text-slate-700 dark:border-slate-700/70 dark:bg-slate-950/60 dark:text-slate-200"
                  >
                    v0.4.0
                  </Badge>
                </div>
                <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Crie caixinhas, acompanhe metas e mova dinheiro do caixa para
                  reservas sem misturar a leitura cronológica do dashboard.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              {isRevalidating ? (
                <Badge
                  variant="outline"
                  className="gap-1 border-slate-200/80 bg-white/78 dark:border-slate-700/80 dark:bg-slate-950/62"
                >
                  <LoaderCircleIcon className="animate-spin" />
                  Sincronizando
                </Badge>
              ) : null}
              <Badge
                variant="outline"
                className="glass-card border-white/60 bg-white/65 uppercase dark:border-slate-700/70 dark:bg-slate-950/55"
              >
                {loaderData.reserves.length} caixinha
                {loaderData.reserves.length === 1 ? "" : "s"}
              </Badge>
            </div>
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

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 md:gap-4">
            <ReserveMetricCard
              accent="slate"
              helper="Total consolidado hoje em todas as caixinhas."
              icon={WalletIcon}
              label="Total guardado"
              value={formatCurrency(totalSaved)}
            />
            <ReserveMetricCard
              accent="sky"
              helper="Reservas independentes monitoradas neste workspace."
              icon={PlusIcon}
              label="Caixinhas ativas"
              value={String(loaderData.reserves.length)}
            />
            <ReserveMetricCard
              accent="emerald"
              helper={
                trackedTargets.length === 0
                  ? "Defina uma meta quando quiser acompanhar o teto." 
                  : "Reservas que já bateram ou superaram o alvo configurado."
              }
              icon={ArrowUpRightIcon}
              label="Metas concluídas"
              value={
                trackedTargets.length === 0
                  ? "Sem meta"
                  : `${completedTargets.length}/${trackedTargets.length}`
              }
            />
            <ReserveMetricCard
              accent="sky"
              helper={
                lastContributionOn
                  ? "Data mais recente entre todos os aportes registrados."
                  : "Ainda não houve nenhum aporte confirmado."
              }
              icon={Clock3Icon}
              label="Último aporte"
              value={lastContributionOn ? formatOccurredOn(lastContributionOn) : "Sem aportes"}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_360px] lg:gap-8">
            <section className="order-2 flex min-w-0 flex-col gap-3 lg:order-1">
              <div className="flex items-center justify-between gap-3 px-1">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Caixinhas
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cada aporte cria uma saída real no dashboard e um crédito na
                    reserva selecionada.
                  </p>
                </div>
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  {loaderData.reserves.length} registro
                  {loaderData.reserves.length === 1 ? "" : "s"}
                </span>
              </div>

              {loaderData.reserves.length === 0 ? (
                <Card className="glass-card rounded-[24px] border-white/55 bg-white/72 py-0 dark:border-slate-700/70 dark:bg-slate-950/55">
                  <CardHeader className="px-5 pt-5">
                    <CardTitle>Sem reservas ainda.</CardTitle>
                    <CardDescription>
                      A primeira caixinha nasce no formulário desta página. Depois
                      disso, os aportes passam a viver em um ledger próprio sem
                      poluir a conta de saldo do mês.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <div className="rounded-2xl border border-dashed border-slate-300/80 bg-slate-50/70 px-4 py-4 text-sm text-slate-600 dark:border-slate-600/60 dark:bg-slate-900/40 dark:text-slate-300">
                      Use nome e meta opcional para abrir o espaço. O restante do
                      fluxo acontece dentro do botão <span className="font-medium">Guardar dinheiro</span>
                      de cada card.
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col gap-3">
                  {loaderData.reserves.map((reserve, index) => (
                    <ReserveCard
                      key={reserve.id}
                      index={index}
                      onAllocate={openAllocationDrawer}
                      reserve={reserve}
                    />
                  ))}
                </div>
              )}
            </section>

            <aside className="order-1 lg:order-2">
              <div className="glass-card rounded-[24px] border-white/55 p-5 dark:border-slate-700/70 dark:bg-slate-950/55 lg:sticky lg:top-6">
                <form className="flex flex-col gap-5" onSubmit={handleCreateReserve}>
                  <div className="flex flex-col gap-2">
                    <span className="font-mono text-[10px] font-medium tracking-[0.22em] uppercase text-slate-500 dark:text-slate-400">
                      Nova reserva
                    </span>
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-50">
                        Criar nova caixinha
                      </h3>
                      <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Nome obrigatório, meta opcional. O dinheiro continua indo
                        para dentro depois, no fluxo de aporte.
                      </p>
                    </div>
                  </div>

                  <FieldGroup className="gap-4">
                    <Field>
                      <FieldLabel htmlFor="reserve-name">Nome da reserva</FieldLabel>
                      <Input
                        autoComplete="off"
                        id="reserve-name"
                        maxLength={80}
                        placeholder="Ex.: Viagem de janeiro"
                        value={createFormState.name}
                        onChange={(event) =>
                          updateCreateFormField("name", event.target.value)
                        }
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="reserve-target">Meta opcional</FieldLabel>
                      <Input
                        id="reserve-target"
                        inputMode="decimal"
                        min="0.01"
                        placeholder="Ex.: 5000"
                        step="0.01"
                        type="number"
                        value={createFormState.targetAmount}
                        onChange={(event) =>
                          updateCreateFormField("targetAmount", event.target.value)
                        }
                      />
                      <FieldDescription>
                        Se deixar em branco, a reserva acompanha apenas o valor
                        acumulado sem barra de meta.
                      </FieldDescription>
                    </Field>
                  </FieldGroup>

                  <FieldError>{createError}</FieldError>

                  <Button
                    className="dashboard-cta w-full"
                    disabled={!canCreateReserve}
                    type="submit"
                  >
                    <PlusIcon data-icon="inline-start" />
                    {isCreating ? "Criando..." : "Criar nova reserva"}
                  </Button>
                </form>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <Drawer
        direction={shouldUseMobileDrawer() ? "bottom" : "right"}
        open={allocationDrawerOpen}
        onOpenChange={handleAllocationDrawerOpenChange}
      >
        <DrawerContent className="bg-white/98 dark:bg-slate-950/98 data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:max-w-md">
          <DrawerHeader>
            <DrawerTitle>
              {selectedReserve
                ? `Guardar dinheiro em ${selectedReserve.name}`
                : "Guardar dinheiro"}
            </DrawerTitle>
            <DrawerDescription>
              O aporte registra uma saída no dashboard e credita o mesmo valor na
              reserva escolhida. Nada fica fora de conciliação.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-5">
            <form className="flex flex-col gap-4" onSubmit={handleAllocateReserve}>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="reserve-allocation-amount">Valor</FieldLabel>
                  <Input
                    id="reserve-allocation-amount"
                    inputMode="decimal"
                    min="0.01"
                    placeholder="Ex.: 250"
                    step="0.01"
                    type="number"
                    value={allocationFormState.amount}
                    onChange={(event) =>
                      updateAllocationFormField("amount", event.target.value)
                    }
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="reserve-allocation-date">Data</FieldLabel>
                  <Input
                    id="reserve-allocation-date"
                    type="date"
                    value={allocationFormState.occurredOn}
                    onChange={(event) =>
                      updateAllocationFormField("occurredOn", event.target.value)
                    }
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="reserve-allocation-description">
                    Descrição
                  </FieldLabel>
                  <Input
                    id="reserve-allocation-description"
                    maxLength={160}
                    placeholder="Ex.: Transferência do caixa do mês"
                    value={allocationFormState.description}
                    onChange={(event) =>
                      updateAllocationFormField(
                        "description",
                        event.target.value
                      )
                    }
                  />
                  <FieldDescription>
                    Essa descrição também será usada na saída criada em
                    <span className="font-mono"> public.transactions</span>.
                  </FieldDescription>
                </Field>
              </FieldGroup>

              <FieldError>{allocationError}</FieldError>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  disabled={isAllocating}
                  type="button"
                  variant="outline"
                  onClick={() => handleAllocationDrawerOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button className="dashboard-cta" disabled={!canAllocate} type="submit">
                  <ArrowUpRightIcon data-icon="inline-start" />
                  {isAllocating ? "Guardando..." : "Confirmar aporte"}
                </Button>
              </div>
            </form>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}

type ReserveMetricCardProps = {
  accent: MetricAccent
  helper: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}

function ReserveMetricCard({
  accent,
  helper,
  icon: Icon,
  label,
  value,
}: ReserveMetricCardProps) {
  const accentClassName =
    accent === "emerald"
      ? "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-200"
      : accent === "sky"
        ? "bg-sky-100/80 text-sky-700 dark:bg-sky-500/12 dark:text-sky-200"
        : "bg-slate-100/85 text-slate-700 dark:bg-slate-800/85 dark:text-slate-200"

  return (
    <Card className="glass-card rounded-[24px] border-white/55 bg-white/72 py-0 dark:border-slate-700/70 dark:bg-slate-950/55">
      <CardHeader className="px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardDescription className="text-[11px] font-medium tracking-[0.18em] uppercase text-slate-500 dark:text-slate-400">
              {label}
            </CardDescription>
            <CardTitle className="text-2xl tracking-tight text-slate-800 dark:text-slate-50">
              {value}
            </CardTitle>
          </div>
          <div className={cn("flex size-11 items-center justify-center rounded-2xl", accentClassName)}>
            <Icon className="size-5" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
          {helper}
        </p>
      </CardContent>
    </Card>
  )
}

type ReserveCardProps = {
  index: number
  onAllocate: (reserve: ReserveSummary) => void
  reserve: ReserveSummary
}

function ReserveCard({ index, onAllocate, reserve }: ReserveCardProps) {
  const progressPercentage = getReserveProgressPercentage(reserve)

  return (
    <Card
      className="glass-card animate-transaction-row rounded-[24px] border-white/55 bg-white/72 py-0 dark:border-slate-700/70 dark:bg-slate-950/55"
      style={
        {
          "--transaction-enter-delay": `${Math.min(index * 50, 320)}ms`,
        } as React.CSSProperties
      }
    >
      <CardHeader className="px-5 pt-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg tracking-tight text-slate-800 dark:text-slate-50">
                {reserve.name}
              </CardTitle>
              <Badge
                variant="outline"
                className={cn(
                  "uppercase",
                  reserve.targetAmount === null
                    ? "border-slate-200/80 bg-slate-50/85 text-slate-700 dark:border-slate-700/70 dark:bg-slate-950/55 dark:text-slate-200"
                    : "border-sky-200/80 bg-sky-50/85 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-200"
                )}
              >
                {reserve.targetAmount === null ? "Sem meta" : "Meta ativa"}
              </Badge>
            </div>
            <CardDescription className="text-sm leading-6 text-slate-600 dark:text-slate-300">
              {reserve.entryCount === 0
                ? "Nenhum aporte ainda. A primeira movimentação já abre o histórico desta caixinha."
                : `${reserve.entryCount} movimentação${reserve.entryCount === 1 ? "" : "ões"} registrada${reserve.entryCount === 1 ? "" : "s"}${reserve.lastEntryOn ? ` · último aporte em ${formatOccurredOn(reserve.lastEntryOn)}` : ""}.`}
            </CardDescription>
          </div>

          <div className="rounded-[20px] border border-white/60 bg-white/70 px-4 py-3 shadow-[0_18px_34px_-26px_rgba(15,23,42,0.35)] dark:border-slate-700/70 dark:bg-slate-950/60">
            <div className="flex items-center gap-2 text-[10px] font-medium tracking-[0.2em] uppercase text-slate-500 dark:text-slate-400">
              <WalletIcon className="size-3.5" />
              Guardado
            </div>
            <div className="mt-2 text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-50">
              {formatCurrency(reserve.currentAmount)}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 px-5 pb-5">
        {progressPercentage === null ? (
          <div className="rounded-2xl border border-dashed border-slate-300/80 bg-slate-50/70 px-4 py-3 text-sm text-slate-600 dark:border-slate-600/60 dark:bg-slate-900/40 dark:text-slate-300">
            Meta livre. Esta caixinha acompanha apenas o saldo acumulado até aqui.
          </div>
        ) : (
          <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-4 dark:border-slate-700/70 dark:bg-slate-950/60">
            <div className="flex items-center justify-between gap-3 text-[11px] font-medium tracking-[0.18em] uppercase text-slate-500 dark:text-slate-400">
              <span>Progresso</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800/80">
              <div
                className={cn(
                  "h-full rounded-full bg-linear-to-r from-sky-500 via-cyan-400 to-emerald-400 transition-[width] duration-300",
                  progressPercentage >= 100
                    ? "from-emerald-500 via-emerald-400 to-lime-300"
                    : null
                )}
                style={{
                  width: `${getVisibleProgressWidth(
                    progressPercentage,
                    reserve.currentAmount
                  )}%`,
                }}
              />
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              {getReserveTargetCopy(reserve)}
            </p>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-3">
          <ReserveFact
            label="Meta"
            value={
              reserve.targetAmount === null
                ? "Flexível"
                : formatCurrency(reserve.targetAmount)
            }
          />
          <ReserveFact
            label="Falta"
            value={
              reserve.remainingAmount === null
                ? "Livre"
                : reserve.remainingAmount <= 0
                  ? "Concluída"
                  : formatCurrency(reserve.remainingAmount)
            }
          />
          <ReserveFact
            label="Último aporte"
            value={
              reserve.lastEntryOn ? formatOccurredOn(reserve.lastEntryOn) : "Sem histórico"
            }
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <CalendarDaysIcon className="size-4" />
            <span>As datas do cofre ficam reconciliadas com o dashboard.</span>
          </div>
          <Button className="dashboard-cta w-full sm:w-auto" type="button" onClick={() => onAllocate(reserve)}>
            <ArrowUpRightIcon data-icon="inline-start" />
            Guardar dinheiro
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

type ReserveFactProps = {
  label: string
  value: string
}

function ReserveFact({ label, value }: ReserveFactProps) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/68 px-3.5 py-3 dark:border-slate-700/70 dark:bg-slate-950/58">
      <div className="text-[10px] font-medium tracking-[0.2em] uppercase text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
        {value}
      </div>
    </div>
  )
}

function createReserveFormState(): CreateReserveFormState {
  return {
    name: "",
    targetAmount: "",
  }
}

function createReserveAllocationFormState(
  reserveName?: string
): ReserveAllocationFormState {
  return {
    amount: "",
    description: reserveName ? `Aporte para ${reserveName}` : "",
    occurredOn: getCurrentOccurredOn(),
  }
}

function formatCurrency(value: number) {
  return BRL_FORMATTER.format(value)
}

function formatOccurredOn(date: string) {
  const [year, month, day] = date.split("-").map(Number)

  return OCCURRED_ON_FORMATTER.format(new Date(Date.UTC(year, month - 1, day)))
}

function getReserveProgressPercentage(reserve: ReserveSummary) {
  if (reserve.targetAmount === null || reserve.targetAmount <= 0) {
    return null
  }

  return Math.max(0, Math.min((reserve.currentAmount / reserve.targetAmount) * 100, 100))
}

function getVisibleProgressWidth(progressPercentage: number, currentAmount: number) {
  if (currentAmount <= 0) {
    return 0
  }

  return Math.max(progressPercentage, 5)
}

function getReserveTargetCopy(reserve: ReserveSummary) {
  if (reserve.targetAmount === null || reserve.remainingAmount === null) {
    return "Esta reserva está operando sem meta. O foco aqui é acumular com disciplina, não perseguir um teto fixo."
  }

  if (reserve.remainingAmount < 0) {
    return `Meta superada em ${formatCurrency(Math.abs(reserve.remainingAmount))}. Você já passou do alvo inicial.`
  }

  if (reserve.remainingAmount === 0) {
    return "Meta concluída. A partir daqui, qualquer novo aporte vira colchão adicional." 
  }

  return `${formatCurrency(reserve.remainingAmount)} faltando para chegar em ${formatCurrency(reserve.targetAmount)}.`
}

function parsePositiveAmount(rawValue: string) {
  const normalizedValue = Number(rawValue.replace(",", ".").trim())

  if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) {
    throw new Error("INVALID_AMOUNT")
  }

  return normalizedValue
}

function parseOptionalPositiveAmount(rawValue: string) {
  const trimmedValue = rawValue.trim()

  if (trimmedValue.length === 0) {
    return null
  }

  const normalizedValue = Number(trimmedValue.replace(",", "."))

  if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) {
    throw new Error("INVALID_TARGET_AMOUNT")
  }

  return normalizedValue
}

function isPositiveAmountInput(rawValue: string) {
  if (rawValue.trim().length === 0) {
    return false
  }

  return Number(rawValue.replace(",", ".")) > 0
}

function isOptionalPositiveAmountInput(rawValue: string) {
  if (rawValue.trim().length === 0) {
    return true
  }

  return Number(rawValue.replace(",", ".")) > 0
}

function shouldUseMobileDrawer() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 1023px)").matches
  )
}

function getReserveFriendlyMessage(
  error: unknown,
  fallback: string
) {
  const message = getRawErrorMessage(error)

  if (message === "RESERVE_NAME_REQUIRED") {
    return "Informe um nome para a nova reserva."
  }

  if (message === "RESERVE_NAME_LENGTH_INVALID") {
    return "O nome da reserva precisa ter entre 2 e 80 caracteres."
  }

  if (message === "RESERVE_NAME_ALREADY_EXISTS") {
    return "Já existe uma reserva com esse nome neste workspace."
  }

  if (message === "INVALID_TARGET_AMOUNT") {
    return "A meta precisa ser um valor positivo quando informada."
  }

  if (message === "INVALID_AMOUNT") {
    return "Informe um valor positivo para o aporte."
  }

  if (message === "INVALID_OCCURRED_ON") {
    return "Escolha uma data válida para o aporte."
  }

  if (message === "INVALID_DESCRIPTION") {
    return "A descrição do aporte precisa ter pelo menos 3 caracteres."
  }

  if (message === "RESERVE_NOT_FOUND") {
    return "A reserva escolhida não foi encontrada neste workspace."
  }

  return getFriendlyErrorMessage(error, fallback)
}

function getRawErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error
  }

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const maybeMessage = error.message

    if (typeof maybeMessage === "string") {
      return maybeMessage
    }
  }

  return "UNKNOWN_ERROR"
}

export default ReservesPage