import * as React from "react"
import { useRevalidator, useRouteLoaderData } from "react-router"
import {
  ArchiveIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  CalendarDaysIcon,
  HistoryIcon,
  LoaderCircleIcon,
  LockIcon,
  PlusIcon,
  WalletIcon,
} from "lucide-react"

import { getFriendlyErrorMessage } from "@/lib/auth"
import { APP_VERSION } from "@/lib/app-meta"
import {
  allocateToReserve,
  archiveReserve,
  createReserve,
  getReserveEntries,
  getCurrentOccurredOn,
  isReserveInitialBalanceEntry,
  withdrawFromReserve,
  type FinanceReserveEntry,
  type ReserveWithdrawalPaymentMethod,
  type ReserveSummary,
} from "@/lib/finance"
import {
  cn,
  formatCurrencyInput,
  hasCurrencyInputValue,
  parseCurrencyInput,
} from "@/lib/utils"
import type { ReservesLoaderData } from "@/routes/data"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
  deductFromCashflow: boolean
  description: string
  occurredOn: string
}

type ReserveWithdrawalFormState = {
  amount: string
  description: string
  occurredOn: string
  paymentMethod: ReserveWithdrawalPaymentMethod
}

type ReserveTabValue = "active" | "completed"

type ReserveDetailsTabValue = "actions" | "history"

type ReserveHistoryState = {
  entries: FinanceReserveEntry[]
  error: string | null
  loaded: boolean
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
  const [withdrawalError, setWithdrawalError] = React.useState<string | null>(
    null
  )
  const [archiveError, setArchiveError] = React.useState<string | null>(null)
  const [createFormState, setCreateFormState] = React.useState(
    createReserveFormState
  )
  const [allocationFormState, setAllocationFormState] = React.useState(
    createReserveAllocationFormState
  )
  const [withdrawalFormState, setWithdrawalFormState] = React.useState(
    createReserveWithdrawalFormState
  )
  const [selectedReserveId, setSelectedReserveId] = React.useState<string | null>(
    null
  )
  const [reserveTab, setReserveTab] = React.useState<ReserveTabValue>("active")
  const [detailsDrawerOpen, setDetailsDrawerOpen] = React.useState(false)
  const [detailsTab, setDetailsTab] = React.useState<ReserveDetailsTabValue>(
    "actions"
  )
  const [historyByReserveId, setHistoryByReserveId] = React.useState<
    Record<string, ReserveHistoryState>
  >({})
  const [historyLoadingReserveId, setHistoryLoadingReserveId] = React.useState<
    string | null
  >(null)
  const [isCreating, setIsCreating] = React.useState(false)
  const [isAllocating, setIsAllocating] = React.useState(false)
  const [isWithdrawing, setIsWithdrawing] = React.useState(false)
  const [isArchiving, setIsArchiving] = React.useState(false)

  const selectedReserve =
    loaderData.reserves.find((reserve) => reserve.id === selectedReserveId) ?? null
  const selectedHistoryState =
    selectedReserve === null
      ? null
      : historyByReserveId[selectedReserve.id] ?? null
  const totalSaved = loaderData.reserves.reduce(
    (sum, reserve) => sum + reserve.currentAmount,
    0
  )
  const activeReserves = loaderData.reserves.filter(
    (reserve) => reserve.status === "active" && !isReserveCompleted(reserve)
  )
  const completedReserves = loaderData.reserves.filter(
    (reserve) => reserve.status === "active" && isReserveCompleted(reserve)
  )
  const archivedReserves = loaderData.reserves.filter(
    (reserve) => reserve.status === "archived"
  )
  const trackedTargets = loaderData.reserves.filter(
    (reserve) => reserve.status === "active" && reserve.targetAmount !== null
  )
  const completedTargets = completedReserves.filter(
    (reserve) => reserve.targetAmount !== null
  )
  const withdrawalAmount = parseCurrencyInput(withdrawalFormState.amount)
  const mobileSupportDefaultSections =
    loaderData.reserves.length === 0 ? ["composer"] : undefined
  const isRevalidating = revalidator.state !== "idle"
  const isHistoryLoading = historyLoadingReserveId === selectedReserve?.id
  const isSelectedReserveActive = selectedReserve?.status === "active"
  const canCreateReserve =
    !isCreating &&
    createFormState.name.trim().length >= 2 &&
    isOptionalPositiveAmountInput(createFormState.targetAmount)
  const canAllocate =
    !isAllocating &&
    isSelectedReserveActive === true &&
    isPositiveAmountInput(allocationFormState.amount) &&
    allocationFormState.description.trim().length >= 3 &&
    allocationFormState.occurredOn.trim().length > 0
  const canWithdraw =
    !isWithdrawing &&
    isSelectedReserveActive === true &&
    withdrawalAmount > 0 &&
    selectedReserve !== null &&
    withdrawalAmount <= selectedReserve.currentAmount &&
    withdrawalFormState.description.trim().length >= 3 &&
    withdrawalFormState.occurredOn.trim().length > 0
  const canArchive =
    !isArchiving &&
    isSelectedReserveActive === true &&
    selectedReserve !== null &&
    Math.abs(selectedReserve.currentAmount) <= 0.000001

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

  function updateWithdrawalFormField<
    Key extends keyof ReserveWithdrawalFormState,
  >(field: Key, value: ReserveWithdrawalFormState[Key]) {
    setWithdrawalError(null)
    setWithdrawalFormState((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function resetReserveActionState(reserveName?: string) {
    setAllocationError(null)
    setWithdrawalError(null)
    setArchiveError(null)
    setAllocationFormState(createReserveAllocationFormState(reserveName))
    setWithdrawalFormState(createReserveWithdrawalFormState(reserveName))
  }

  function handleDetailsDrawerOpenChange(open: boolean) {
    setDetailsDrawerOpen(open)

    if (!open) {
      setSelectedReserveId(null)
      setDetailsTab("actions")
      resetReserveActionState()
    }
  }

  function openReserveDetails(reserve: ReserveSummary) {
    setFeedback(null)
    setSelectedReserveId(reserve.id)
    setDetailsTab("actions")
    resetReserveActionState(reserve.name)
    setDetailsDrawerOpen(true)
  }

  async function loadReserveHistory(reserve: ReserveSummary, force = false) {
    const currentState = historyByReserveId[reserve.id]

    if (historyLoadingReserveId === reserve.id) {
      return
    }

    if (!force && currentState?.loaded) {
      return
    }

    if (!force && reserve.entryCount === 0) {
      setHistoryByReserveId((current) => ({
        ...current,
        [reserve.id]: {
          entries: [],
          error: null,
          loaded: true,
        },
      }))

      return
    }

    setHistoryLoadingReserveId(reserve.id)
    setHistoryByReserveId((current) => ({
      ...current,
      [reserve.id]: {
        entries: current[reserve.id]?.entries ?? [],
        error: null,
        loaded: false,
      },
    }))

    try {
      const entries = await getReserveEntries(reserve.id)

      setHistoryByReserveId((current) => ({
        ...current,
        [reserve.id]: {
          entries,
          error: null,
          loaded: true,
        },
      }))
    } catch (error) {
      setHistoryByReserveId((current) => ({
        ...current,
        [reserve.id]: {
          entries: current[reserve.id]?.entries ?? [],
          error: getReserveFriendlyMessage(
            error,
            "Não foi possível carregar o histórico desta caixinha."
          ),
          loaded: true,
        },
      }))
    } finally {
      setHistoryLoadingReserveId((current) =>
        current === reserve.id ? null : current
      )
    }
  }

  function handleDetailsTabChange(value: string) {
    const nextValue = value as ReserveDetailsTabValue

    setDetailsTab(nextValue)

    if (nextValue === "history" && selectedReserve) {
      void loadReserveHistory(selectedReserve)
    }
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
      const allocationAmount = parsePositiveAmount(allocationFormState.amount)
      const reserveName = selectedReserve.name

      await allocateToReserve({
        amount: allocationAmount,
        deductFromCashflow: allocationFormState.deductFromCashflow,
        description: allocationFormState.description,
        occurredOn: allocationFormState.occurredOn,
        reserveId: selectedReserve.id,
      })

      setFeedback({
        kind: "success",
        message: allocationFormState.deductFromCashflow
          ? `${formatCurrency(allocationAmount)} guardado em "${reserveName}" com sucesso.`
          : `${formatCurrency(allocationAmount)} registrado em "${reserveName}" como saldo inicial.`,
      })
      setDetailsTab("history")
      setAllocationFormState(createReserveAllocationFormState(reserveName))
      await loadReserveHistory(selectedReserve, true)
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

  async function handleWithdrawReserve(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedReserve) {
      return
    }

    setFeedback(null)
    setWithdrawalError(null)
    setIsWithdrawing(true)

    try {
      const reserveName = selectedReserve.name
      const amount = parsePositiveAmount(withdrawalFormState.amount)

      await withdrawFromReserve({
        amount,
        description: withdrawalFormState.description,
        occurredOn: withdrawalFormState.occurredOn,
        paymentMethod: withdrawalFormState.paymentMethod,
        reserveId: selectedReserve.id,
      })

      setFeedback({
        kind: "success",
        message: `${formatCurrency(amount)} resgatado de "${reserveName}" com sucesso.`,
      })
      setDetailsTab("history")
      setWithdrawalFormState(createReserveWithdrawalFormState(reserveName))
      await loadReserveHistory(selectedReserve, true)
      React.startTransition(() => {
        revalidator.revalidate()
      })
    } catch (error) {
      setWithdrawalError(
        getReserveFriendlyMessage(
          error,
          "Não foi possível resgatar esse dinheiro agora."
        )
      )
    } finally {
      setIsWithdrawing(false)
    }
  }

  async function handleArchiveReserve() {
    if (!selectedReserve) {
      return
    }

    setFeedback(null)
    setArchiveError(null)
    setIsArchiving(true)

    try {
      await archiveReserve({
        currentAmount: selectedReserve.currentAmount,
        reserveId: selectedReserve.id,
      })

      setFeedback({
        kind: "success",
        message: `Caixinha "${selectedReserve.name}" arquivada com sucesso.`,
      })
      setDetailsTab("history")
      React.startTransition(() => {
        revalidator.revalidate()
      })
    } catch (error) {
      setArchiveError(
        getReserveFriendlyMessage(
          error,
          "Não foi possível arquivar esta caixinha agora."
        )
      )
    } finally {
      setIsArchiving(false)
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
                    v{APP_VERSION}
                  </Badge>
                </div>
                <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Crie caixinhas, acompanhe metas, resgate quando precisar e
                  arquive o que já fechou ciclo sem perder auditabilidade.
                </p>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
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

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 md:gap-4">
            <ReserveMetricCard
              accent="slate"
              helper="Total consolidado hoje em todas as caixinhas."
              icon={WalletIcon}
              label="Total guardado"
              value={formatCurrency(totalSaved)}
            />
            <ReserveMetricCard
              accent="sky"
              helper="Caixinhas que ainda estão recebendo saldo ou ainda não bateram a meta."
              icon={PlusIcon}
              label="Caixinhas ativas"
              value={String(activeReserves.length)}
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
              helper="Reservas fechadas para novas movimentações, mas preservadas para consulta histórica."
              icon={ArchiveIcon}
              label="Arquivadas"
              value={String(archivedReserves.length)}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_360px] lg:gap-8">
            <section className="order-1 flex min-w-0 flex-col gap-4">
              {loaderData.reserves.length === 0 ? (
                <Card className="glass-card rounded-[24px] border-white/55 bg-white/72 py-0 dark:border-slate-700/70 dark:bg-slate-950/55">
                  <CardHeader className="px-5 pt-5">
                    <CardTitle>Sem reservas ainda.</CardTitle>
                    <CardDescription>
                      A primeira caixinha nasce no painel lateral no desktop e no
                      acordeão abaixo no mobile. Depois disso, ações e histórico
                      passam a viver no Drawer de detalhes.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <div className="rounded-2xl border border-dashed border-slate-300/80 bg-slate-50/70 px-4 py-4 text-sm text-slate-600 dark:border-slate-600/60 dark:bg-slate-900/40 dark:text-slate-300">
                      Use nome e meta opcional para abrir o espaço. O fluxo volta a
                      separar o operacional em abas e preserva as arquivadas como
                      camada própria de consulta.
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Tabs
                  value={reserveTab}
                  onValueChange={(value) => setReserveTab(value as ReserveTabValue)}
                  className="flex flex-col gap-4"
                >
                  <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Fluxo operacional das caixinhas
                      </h3>
                      <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                        Ativas e concluídas voltam para a navegação principal. As
                        arquivadas ficam separadas para manter leitura limpa sem
                        perder acesso ao histórico.
                      </p>
                    </div>

                    <TabsList className="grid w-full grid-cols-2 sm:w-auto">
                      <TabsTrigger value="active">
                        Ativas ({activeReserves.length})
                      </TabsTrigger>
                      <TabsTrigger value="completed">
                        Concluídas ({completedReserves.length})
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="active" className="mt-0">
                    <ReserveCardsList
                      emptyDescription="Caixinhas sem meta ou ainda abaixo do alvo continuam aparecendo aqui até fechar o ciclo."
                      emptyTitle="Nenhuma caixinha ativa."
                      reserves={activeReserves}
                      onOpen={openReserveDetails}
                    />
                  </TabsContent>

                  <TabsContent value="completed" className="mt-0">
                    <ReserveCardsList
                      emptyDescription="Assim que uma reserva ativa com meta atingir ou ultrapassar o alvo, ela migra para esta aba."
                      emptyTitle="Nenhuma meta concluída ainda."
                      reserves={completedReserves}
                      onOpen={openReserveDetails}
                    />
                  </TabsContent>
                </Tabs>
              )}

              <div className="lg:hidden">
                <Accordion
                  type="multiple"
                  defaultValue={mobileSupportDefaultSections}
                  className="flex flex-col gap-3"
                >
                  <AccordionItem className="glass-card overflow-hidden rounded-[22px] border border-white/55 bg-white/72 px-0 dark:border-slate-700/70 dark:bg-slate-950/55" value="composer">
                    <AccordionTrigger className="px-4 py-4 hover:no-underline">
                      <MobileAccordionTrigger
                        description="Abra novas reservas sem disputar espaço com a leitura do cofre."
                        title="Nova caixinha"
                      />
                    </AccordionTrigger>
                    <AccordionContent className="px-4">
                      <ReserveComposerForm
                        canCreateReserve={canCreateReserve}
                        createError={createError}
                        createFormState={createFormState}
                        isCreating={isCreating}
                        onSubmit={handleCreateReserve}
                        onValueChange={updateCreateFormField}
                      />
                    </AccordionContent>
                  </AccordionItem>

                  {loaderData.reserves.length > 0 ? (
                    <AccordionItem className="glass-card overflow-hidden rounded-[22px] border border-white/55 bg-white/72 px-0 dark:border-slate-700/70 dark:bg-slate-950/55" value="archived">
                      <AccordionTrigger className="px-4 py-4 hover:no-underline">
                        <MobileAccordionTrigger
                          count={archivedReserves.length}
                          description="Reservas fechadas para novas ações, mas preservadas para consulta."
                          title="Arquivadas"
                        />
                      </AccordionTrigger>
                      <AccordionContent className="px-4">
                        <ReserveCardsList
                          emptyDescription="Arquive apenas quando o saldo estiver zerado. O histórico continua acessível dentro do Drawer."
                          emptyTitle="Nenhuma reserva arquivada."
                          reserves={archivedReserves}
                          onOpen={openReserveDetails}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  ) : null}
                </Accordion>
              </div>

              <div className="hidden lg:flex lg:flex-col lg:gap-5">
                {loaderData.reserves.length > 0 ? (
                  <ReserveDesktopSection
                    description="Histórico preservado para consulta, com novas ações bloqueadas."
                    emptyDescription="Arquive apenas reservas zeradas. Depois disso, elas aparecem exclusivamente aqui."
                    emptyTitle="Nenhuma reserva arquivada."
                    reserves={archivedReserves}
                    title={`Arquivadas (${archivedReserves.length})`}
                    onOpen={openReserveDetails}
                  />
                ) : null}
              </div>
            </section>

            <aside className="order-2 hidden lg:block">
              <div className="glass-card rounded-[24px] border-white/55 p-5 dark:border-slate-700/70 dark:bg-slate-950/55 lg:sticky lg:top-6">
                <ReserveComposerForm
                  canCreateReserve={canCreateReserve}
                  createError={createError}
                  createFormState={createFormState}
                  isCreating={isCreating}
                  onSubmit={handleCreateReserve}
                  onValueChange={updateCreateFormField}
                />
              </div>
            </aside>
          </div>
        </div>
      </section>

      <Drawer
        direction={shouldUseMobileDrawer() ? "bottom" : "right"}
        open={detailsDrawerOpen}
        onOpenChange={handleDetailsDrawerOpenChange}
      >
        <DrawerContent className="bg-white/98 dark:bg-slate-950/98 data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:max-w-5xl!">
          <DrawerHeader>
            <DrawerTitle>
              {selectedReserve
                ? selectedReserve.name
                : "Detalhes da reserva"}
            </DrawerTitle>
            <DrawerDescription>
              {selectedReserve
                ? selectedReserve.status === "archived"
                  ? "Histórico preservado para consulta. As ações operacionais ficam bloqueadas nesta fase."
                  : "Guarde, resgate, acompanhe o histórico e arquive esta caixinha sem perder conciliação com o dashboard."
                : "Abra uma caixinha para ver ações e histórico."}
            </DrawerDescription>
          </DrawerHeader>
          {selectedReserve ? (
            <div className="flex flex-col gap-5 px-4 pb-5 xl:grid xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] xl:items-start xl:gap-6">
              <div className="xl:sticky xl:top-0 xl:self-start">
                <ReserveDrawerSummary reserve={selectedReserve} />
              </div>

              <Tabs
                value={detailsTab}
                onValueChange={handleDetailsTabChange}
                className="flex min-w-0 flex-col gap-4"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="actions">Ações</TabsTrigger>
                  <TabsTrigger value="history">Histórico</TabsTrigger>
                </TabsList>

                <TabsContent value="actions" className="mt-0 flex flex-col gap-4">
                  {selectedReserve.status === "archived" ? (
                    <Card className="rounded-[22px] border border-slate-200/80 bg-slate-50/85 py-0 dark:border-slate-700/70 dark:bg-slate-900/55">
                      <CardContent className="flex items-start gap-3 px-4 py-4">
                        <div className="mt-0.5 flex size-9 items-center justify-center rounded-2xl bg-slate-200/70 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          <LockIcon className="size-4" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            Esta caixinha está arquivada.
                          </p>
                          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                            O histórico continua disponível, mas guardar,
                            resgatar e arquivar novamente ficam bloqueados em
                            v0.5.3.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}

                  <Card className="glass-card rounded-[22px] border-white/55 bg-white/72 py-0 dark:border-slate-700/70 dark:bg-slate-950/55">
                    <CardHeader className="px-4 pt-4 sm:px-5 sm:pt-5">
                      <CardTitle>Guardar dinheiro</CardTitle>
                      <CardDescription>
                        Um aporte pode virar saída real no dashboard ou apenas
                        compor o saldo inicial desta caixinha.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
                      <form className="flex flex-col gap-4" onSubmit={handleAllocateReserve}>
                        <FieldGroup className="gap-4">
                          <Field>
                            <FieldLabel htmlFor="reserve-allocation-amount">Valor</FieldLabel>
                            <Input
                              id="reserve-allocation-amount"
                              autoComplete="off"
                              disabled={!isSelectedReserveActive || isAllocating}
                              inputMode="numeric"
                              placeholder="0,00"
                              type="text"
                              value={allocationFormState.amount}
                              onChange={(event) =>
                                updateAllocationFormField(
                                  "amount",
                                  formatCurrencyInput(event.target.value)
                                )
                              }
                            />
                          </Field>

                          <Field>
                            <FieldLabel htmlFor="reserve-allocation-date">Data</FieldLabel>
                            <Input
                              id="reserve-allocation-date"
                              disabled={!isSelectedReserveActive || isAllocating}
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
                              disabled={!isSelectedReserveActive || isAllocating}
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
                              Essa descrição também será usada quando houver uma
                              saída criada em public.transactions.
                            </FieldDescription>
                          </Field>

                          <Field orientation="horizontal">
                            <Checkbox
                              id="reserve-allocation-detached"
                              checked={allocationFormState.deductFromCashflow === false}
                              disabled={!isSelectedReserveActive || isAllocating}
                              onCheckedChange={(checked) =>
                                updateAllocationFormField(
                                  "deductFromCashflow",
                                  checked !== true
                                )
                              }
                            />
                            <FieldContent>
                              <FieldLabel htmlFor="reserve-allocation-detached">
                                Este valor ja estava guardado
                              </FieldLabel>
                              <FieldDescription>
                                Marque quando o dinheiro não deve descontar o
                                caixa do mês. O histórico identifica isso como
                                Saldo inicial.
                              </FieldDescription>
                            </FieldContent>
                          </Field>
                        </FieldGroup>

                        <FieldError>{allocationError}</FieldError>

                        <div className="flex justify-end">
                          <Button className="dashboard-cta" disabled={!canAllocate} type="submit">
                            <ArrowUpRightIcon data-icon="inline-start" />
                            {isAllocating ? "Guardando..." : "Confirmar aporte"}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>

                  <Card className="glass-card rounded-[22px] border-white/55 bg-white/72 py-0 dark:border-slate-700/70 dark:bg-slate-950/55">
                    <CardHeader className="px-4 pt-4 sm:px-5 sm:pt-5">
                      <CardTitle>Resgatar dinheiro</CardTitle>
                      <CardDescription>
                        O resgate credita o dashboard como entrada de Reserva.
                        Saldo disponível agora: {formatCurrency(selectedReserve.currentAmount)}.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
                      <form className="flex flex-col gap-4" onSubmit={handleWithdrawReserve}>
                        <FieldGroup className="gap-4">
                          <Field>
                            <FieldLabel htmlFor="reserve-withdrawal-amount">Valor</FieldLabel>
                            <Input
                              id="reserve-withdrawal-amount"
                              autoComplete="off"
                              disabled={!isSelectedReserveActive || isWithdrawing}
                              inputMode="numeric"
                              placeholder="0,00"
                              type="text"
                              value={withdrawalFormState.amount}
                              onChange={(event) =>
                                updateWithdrawalFormField(
                                  "amount",
                                  formatCurrencyInput(event.target.value)
                                )
                              }
                            />
                          </Field>

                          <Field>
                            <FieldLabel htmlFor="reserve-withdrawal-date">Data</FieldLabel>
                            <Input
                              id="reserve-withdrawal-date"
                              disabled={!isSelectedReserveActive || isWithdrawing}
                              type="date"
                              value={withdrawalFormState.occurredOn}
                              onChange={(event) =>
                                updateWithdrawalFormField("occurredOn", event.target.value)
                              }
                            />
                          </Field>

                          <Field>
                            <FieldLabel htmlFor="reserve-withdrawal-description">
                              Descrição
                            </FieldLabel>
                            <Input
                              id="reserve-withdrawal-description"
                              disabled={!isSelectedReserveActive || isWithdrawing}
                              maxLength={160}
                              placeholder="Ex.: Volta para o caixa operacional"
                              value={withdrawalFormState.description}
                              onChange={(event) =>
                                updateWithdrawalFormField(
                                  "description",
                                  event.target.value
                                )
                              }
                            />
                          </Field>

                          <Field>
                            <FieldLabel htmlFor="reserve-withdrawal-payment-method">
                              Meio de entrada
                            </FieldLabel>
                            <Select
                              disabled={!isSelectedReserveActive || isWithdrawing}
                              value={withdrawalFormState.paymentMethod}
                              onValueChange={(value) =>
                                updateWithdrawalFormField(
                                  "paymentMethod",
                                  value as ReserveWithdrawalPaymentMethod
                                )
                              }
                            >
                              <SelectTrigger id="reserve-withdrawal-payment-method" className="w-full">
                                <SelectValue placeholder="Selecione o meio" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectItem value="cash">Dinheiro</SelectItem>
                                  <SelectItem value="pix">Pix</SelectItem>
                                  <SelectItem value="debit">Débito</SelectItem>
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <FieldDescription>
                              Resgates acima do saldo disponível são bloqueados.
                            </FieldDescription>
                          </Field>
                        </FieldGroup>

                        <FieldError>{withdrawalError}</FieldError>

                        <div className="flex justify-end">
                          <Button className="dashboard-cta" disabled={!canWithdraw} type="submit">
                            <ArrowDownLeftIcon data-icon="inline-start" />
                            {isWithdrawing ? "Resgatando..." : "Confirmar resgate"}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>

                  <Card className="rounded-[22px] border border-slate-200/80 bg-white/82 py-0 dark:border-slate-700/70 dark:bg-slate-950/55">
                    <CardHeader className="px-4 pt-4 sm:px-5 sm:pt-5">
                      <CardTitle>Arquivar caixinha</CardTitle>
                      <CardDescription>
                        O arquivamento fecha novas movimentações, mas preserva o
                        histórico. O saldo precisa estar zerado.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
                      <div className="flex flex-col gap-3">
                        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                          {selectedReserve.status === "archived"
                            ? "Esta caixinha já foi arquivada e permanece disponível apenas para consulta."
                            : Math.abs(selectedReserve.currentAmount) > 0.000001
                              ? `Zere o saldo atual de ${formatCurrency(selectedReserve.currentAmount)} antes de arquivar.`
                              : "Saldo zerado. Esta caixinha já pode sair do fluxo operacional sem perder histórico."}
                        </p>

                        <FieldError>{archiveError}</FieldError>

                        <div className="flex justify-end">
                          <Button
                            disabled={selectedReserve.status === "archived" || !canArchive}
                            type="button"
                            variant="outline"
                            onClick={handleArchiveReserve}
                          >
                            <ArchiveIcon data-icon="inline-start" />
                            {selectedReserve.status === "archived"
                              ? "Já arquivada"
                              : isArchiving
                                ? "Arquivando..."
                                : "Arquivar caixinha"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="history" className="mt-0">
                  <ReserveHistoryPanel
                    historyState={selectedHistoryState}
                    isLoading={isHistoryLoading}
                    reserve={selectedReserve}
                    onRetry={() => void loadReserveHistory(selectedReserve, true)}
                  />
                </TabsContent>
              </Tabs>
            </div>
          ) : null}
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
    <Card className="glass-card rounded-[22px] border-white/55 bg-white/72 py-0 dark:border-slate-700/70 dark:bg-slate-950/55 sm:rounded-[24px]">
      <CardHeader className="px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardDescription className="text-[11px] font-medium tracking-[0.18em] uppercase text-slate-500 dark:text-slate-400">
              {label}
            </CardDescription>
            <CardTitle className="text-lg tracking-tight text-slate-800 sm:text-2xl dark:text-slate-50">
              {value}
            </CardTitle>
          </div>
          <div className={cn("flex size-10 items-center justify-center rounded-2xl sm:size-11", accentClassName)}>
            <Icon className="size-4 sm:size-5" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
          {helper}
        </p>
      </CardContent>
    </Card>
  )
}

type MobileAccordionTriggerProps = {
  count?: number
  description: string
  title: string
}

type ReserveCardsListProps = {
  emptyDescription: string
  emptyTitle: string
  onOpen: (reserve: ReserveSummary) => void
  reserves: ReserveSummary[]
}

type ReserveDesktopSectionProps = ReserveCardsListProps & {
  description: string
  title: string
}

type ReserveDrawerSummaryProps = {
  reserve: ReserveSummary
}

type ReserveHistoryPanelProps = {
  historyState: ReserveHistoryState | null
  isLoading: boolean
  onRetry: () => void
  reserve: ReserveSummary
}

type ReserveCardProps = {
  index: number
  onOpen: (reserve: ReserveSummary) => void
  reserve: ReserveSummary
}

function MobileAccordionTrigger({
  count,
  description,
  title,
}: MobileAccordionTriggerProps) {
  return (
    <div className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </span>
          {typeof count === "number" ? (
            <Badge variant="outline" className="uppercase">
              {count}
            </Badge>
          ) : null}
        </div>
        <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
    </div>
  )
}

function ReserveCardsList({
  emptyDescription,
  emptyTitle,
  onOpen,
  reserves,
}: ReserveCardsListProps) {
  if (reserves.length === 0) {
    return (
      <Card className="rounded-[22px] border border-dashed border-slate-300/80 bg-slate-50/75 py-0 dark:border-slate-700/70 dark:bg-slate-900/45">
        <CardHeader className="px-4 pt-4 sm:px-5 sm:pt-5">
          <CardTitle>{emptyTitle}</CardTitle>
          <CardDescription>{emptyDescription}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {reserves.map((reserve, index) => (
        <ReserveCard
          key={reserve.id}
          index={index}
          onOpen={onOpen}
          reserve={reserve}
        />
      ))}
    </div>
  )
}

function ReserveDesktopSection({
  description,
  emptyDescription,
  emptyTitle,
  onOpen,
  reserves,
  title,
}: ReserveDesktopSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="px-1">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <ReserveCardsList
        emptyDescription={emptyDescription}
        emptyTitle={emptyTitle}
        onOpen={onOpen}
        reserves={reserves}
      />
    </section>
  )
}

function ReserveDrawerSummary({ reserve }: ReserveDrawerSummaryProps) {
  const progressPercentage = getReserveProgressPercentage(reserve)

  return (
    <Card className="glass-card rounded-[22px] border-white/55 bg-white/72 py-0 dark:border-slate-700/70 dark:bg-slate-950/55">
      <CardHeader className="px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl tracking-tight text-slate-800 dark:text-slate-50">
                {reserve.name}
              </CardTitle>
              <Badge
                variant="outline"
                className={cn(
                  "uppercase",
                  reserve.status === "archived"
                    ? "border-slate-300/80 bg-slate-100/85 text-slate-700 dark:border-slate-600/70 dark:bg-slate-800/80 dark:text-slate-200"
                    : isReserveCompleted(reserve)
                      ? "border-emerald-200/80 bg-emerald-50/85 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                      : reserve.targetAmount === null
                        ? "border-slate-200/80 bg-slate-50/85 text-slate-700 dark:border-slate-700/70 dark:bg-slate-950/55 dark:text-slate-200"
                        : "border-sky-200/80 bg-sky-50/85 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-200"
                )}
              >
                {reserve.status === "archived"
                  ? "Arquivada"
                  : isReserveCompleted(reserve)
                    ? "Concluída"
                    : reserve.targetAmount === null
                      ? "Sem meta"
                      : "Meta ativa"}
              </Badge>
            </div>
            <CardDescription className="text-sm leading-6 text-slate-600 dark:text-slate-300">
              {reserve.entryCount === 0
                ? "Nenhuma movimentação ainda. O primeiro aporte já cria o histórico desta caixinha."
                : `${reserve.entryCount} movimentação${reserve.entryCount === 1 ? "" : "ões"} registrada${reserve.entryCount === 1 ? "" : "s"}${reserve.lastEntryOn ? ` · última em ${formatOccurredOn(reserve.lastEntryOn)}` : ""}.`}
            </CardDescription>
          </div>

          <div className="rounded-[18px] border border-white/60 bg-white/70 px-3.5 py-3 shadow-[0_18px_34px_-26px_rgba(15,23,42,0.35)] dark:border-slate-700/70 dark:bg-slate-950/60 sm:rounded-[20px] sm:px-4">
            <div className="flex items-center gap-2 text-[10px] font-medium tracking-[0.2em] uppercase text-slate-500 dark:text-slate-400">
              <WalletIcon className="size-3.5" />
              Saldo atual
            </div>
            <div className="mt-2 text-lg font-semibold tracking-tight text-slate-800 sm:text-xl dark:text-slate-50">
              {formatCurrency(reserve.currentAmount)}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 px-4 pb-4 sm:px-5 sm:pb-5">
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
            label="Histórico"
            value={reserve.entryCount === 0 ? "Sem eventos" : `${reserve.entryCount} item(ns)`}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function ReserveHistoryPanel({
  historyState,
  isLoading,
  onRetry,
  reserve,
}: ReserveHistoryPanelProps) {
  if (isLoading) {
    return (
      <Card className="glass-card rounded-[22px] border-white/55 bg-white/72 py-0 dark:border-slate-700/70 dark:bg-slate-950/55">
        <CardContent className="flex items-center gap-3 px-4 py-4 sm:px-5">
          <LoaderCircleIcon className="size-4 animate-spin text-slate-500 dark:text-slate-300" />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Carregando histórico desta caixinha...
          </p>
        </CardContent>
      </Card>
    )
  }

  if (historyState?.error) {
    return (
      <Card className="rounded-[22px] border border-rose-200/80 bg-rose-50/82 py-0 dark:border-rose-500/30 dark:bg-rose-950/25">
        <CardContent className="flex flex-col gap-3 px-4 py-4 sm:px-5">
          <p className="text-sm text-rose-700 dark:text-rose-200">
            {historyState.error}
          </p>
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onRetry}>
              <HistoryIcon data-icon="inline-start" />
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (reserve.entryCount === 0 || (historyState?.loaded && historyState.entries.length === 0)) {
    return (
      <Card className="rounded-[22px] border border-dashed border-slate-300/80 bg-slate-50/75 py-0 dark:border-slate-700/70 dark:bg-slate-900/45">
        <CardHeader className="px-4 pt-4 sm:px-5 sm:pt-5">
          <CardTitle>Histórico vazio</CardTitle>
          <CardDescription>
            Esta caixinha ainda não recebeu aportes nem resgates.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {historyState?.entries.map((entry, index) => (
        <Card
          key={entry.id}
          className="glass-card animate-transaction-row rounded-[22px] border-white/55 bg-white/72 py-0 dark:border-slate-700/70 dark:bg-slate-950/55"
          style={
            {
              "--transaction-enter-delay": `${Math.min(index * 40, 240)}ms`,
            } as React.CSSProperties
          }
        >
          <CardContent className="flex flex-col gap-3 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      entry.entryType === "in"
                        ? "border-emerald-200/80 bg-emerald-50/85 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                        : "border-sky-200/80 bg-sky-50/85 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-200"
                    )}
                  >
                    {entry.entryType === "in" ? "Entrada" : "Saída"}
                  </Badge>
                  {isReserveInitialBalanceEntry(entry) ? (
                    <Badge variant="secondary">Saldo inicial</Badge>
                  ) : null}
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {formatOccurredOn(entry.occurredOn)}
                  </span>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {entry.description}
                  </p>
                  {entry.notes ? (
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {entry.notes}
                    </p>
                  ) : null}
                </div>
              </div>

              <div
                className={cn(
                  "text-base font-semibold tracking-tight sm:text-right",
                  entry.entryType === "in"
                    ? "text-emerald-700 dark:text-emerald-200"
                    : "text-sky-700 dark:text-sky-200"
                )}
              >
                {formatReserveEntryAmount(entry)}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ReserveCard({ index, onOpen, reserve }: ReserveCardProps) {
  const progressPercentage = getReserveProgressPercentage(reserve)

  return (
    <Card
      className="glass-card animate-transaction-row rounded-[22px] border-white/55 bg-white/72 py-0 dark:border-slate-700/70 dark:bg-slate-950/55 sm:rounded-[24px]"
      style={
        {
          "--transaction-enter-delay": `${Math.min(index * 50, 320)}ms`,
        } as React.CSSProperties
      }
    >
      <CardHeader className="px-4 pt-4 sm:px-5 sm:pt-5">
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
                  reserve.status === "archived"
                    ? "border-slate-300/80 bg-slate-100/85 text-slate-700 dark:border-slate-600/70 dark:bg-slate-800/80 dark:text-slate-200"
                    : isReserveCompleted(reserve)
                      ? "border-emerald-200/80 bg-emerald-50/85 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                      : reserve.targetAmount === null
                        ? "border-slate-200/80 bg-slate-50/85 text-slate-700 dark:border-slate-700/70 dark:bg-slate-950/55 dark:text-slate-200"
                        : "border-sky-200/80 bg-sky-50/85 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-200"
                )}
              >
                {reserve.status === "archived"
                  ? "Arquivada"
                  : isReserveCompleted(reserve)
                    ? "Concluída"
                    : reserve.targetAmount === null
                      ? "Sem meta"
                      : "Meta ativa"}
              </Badge>
            </div>
            <CardDescription className="text-sm leading-6 text-slate-600 dark:text-slate-300">
              {reserve.status === "archived"
                ? "Fechada para novas movimentações, com histórico preservado para consulta."
                : reserve.entryCount === 0
                  ? "Nenhum aporte ainda. O Drawer desta caixinha concentra ações e histórico assim que o primeiro evento entrar."
                  : `${reserve.entryCount} movimentação${reserve.entryCount === 1 ? "" : "ões"} registrada${reserve.entryCount === 1 ? "" : "s"}${reserve.lastEntryOn ? ` · última em ${formatOccurredOn(reserve.lastEntryOn)}` : ""}.`}
            </CardDescription>
          </div>

          <div className="rounded-[18px] border border-white/60 bg-white/70 px-3.5 py-3 shadow-[0_18px_34px_-26px_rgba(15,23,42,0.35)] dark:border-slate-700/70 dark:bg-slate-950/60 sm:rounded-[20px] sm:px-4">
            <div className="flex items-center gap-2 text-[10px] font-medium tracking-[0.2em] uppercase text-slate-500 dark:text-slate-400">
              <WalletIcon className="size-3.5" />
              Guardado
            </div>
            <div className="mt-2 text-lg font-semibold tracking-tight text-slate-800 sm:text-xl dark:text-slate-50">
              {formatCurrency(reserve.currentAmount)}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 px-4 pb-4 sm:px-5 sm:pb-5">
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
            label="Última"
            value={reserve.lastEntryOn ? formatOccurredOn(reserve.lastEntryOn) : "Sem histórico"}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="hidden items-center gap-2 text-xs text-slate-500 dark:text-slate-400 sm:flex">
            <CalendarDaysIcon className="size-4" />
            <span>As datas do cofre ficam reconciliadas com o dashboard.</span>
          </div>
          <Button className="dashboard-cta w-full sm:w-auto" type="button" onClick={() => onOpen(reserve)}>
            {reserve.status === "archived" ? (
              <HistoryIcon data-icon="inline-start" />
            ) : (
              <ArrowUpRightIcon data-icon="inline-start" />
            )}
            {reserve.status === "archived" ? "Ver histórico" : "Abrir detalhes"}
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

type ReserveComposerFormProps = {
  canCreateReserve: boolean
  createError: string | null
  createFormState: CreateReserveFormState
  isCreating: boolean
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onValueChange: <Key extends keyof CreateReserveFormState>(
    field: Key,
    value: CreateReserveFormState[Key]
  ) => void
}

function ReserveFact({ label, value }: ReserveFactProps) {
  return (
    <div className="rounded-[18px] border border-white/60 bg-white/68 px-3.5 py-3 dark:border-slate-700/70 dark:bg-slate-950/58 sm:rounded-2xl">
      <div className="text-[10px] font-medium tracking-[0.2em] uppercase text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
        {value}
      </div>
    </div>
  )
}

function ReserveComposerForm({
  canCreateReserve,
  createError,
  createFormState,
  isCreating,
  onSubmit,
  onValueChange,
}: ReserveComposerFormProps) {
  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] font-medium tracking-[0.22em] uppercase text-slate-500 dark:text-slate-400">
          Nova reserva
        </span>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-50">
            Criar nova caixinha
          </h3>
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            Nome obrigatório, meta opcional. Depois disso, aportes, resgates e
            histórico passam a morar no Drawer de detalhes.
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
            onChange={(event) => onValueChange("name", event.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="reserve-target">Meta opcional</FieldLabel>
          <Input
            autoComplete="off"
            id="reserve-target"
            inputMode="numeric"
            placeholder="0,00"
            type="text"
            value={createFormState.targetAmount}
            onChange={(event) =>
              onValueChange("targetAmount", formatCurrencyInput(event.target.value))
            }
          />
          <FieldDescription>
            Se deixar em branco, a reserva acompanha apenas o valor acumulado sem
            barra de meta.
          </FieldDescription>
        </Field>
      </FieldGroup>

      <FieldError>{createError}</FieldError>

      <Button className="dashboard-cta w-full" disabled={!canCreateReserve} type="submit">
        <PlusIcon data-icon="inline-start" />
        {isCreating ? "Criando..." : "Criar nova reserva"}
      </Button>
    </form>
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
    deductFromCashflow: true,
    description: reserveName ? `Aporte para ${reserveName}` : "",
    occurredOn: getCurrentOccurredOn(),
  }
}

function createReserveWithdrawalFormState(
  reserveName?: string
): ReserveWithdrawalFormState {
  return {
    amount: "",
    description: reserveName ? `Resgate de ${reserveName}` : "",
    occurredOn: getCurrentOccurredOn(),
    paymentMethod: "cash",
  }
}

function isReserveCompleted(reserve: ReserveSummary) {
  return reserve.targetAmount !== null && (reserve.remainingAmount ?? 0) <= 0
}

function formatCurrency(value: number) {
  return BRL_FORMATTER.format(value)
}

function formatOccurredOn(date: string) {
  const [year, month, day] = date.split("-").map(Number)

  return OCCURRED_ON_FORMATTER.format(new Date(Date.UTC(year, month - 1, day)))
}

function formatReserveEntryAmount(entry: FinanceReserveEntry) {
  const prefix = entry.entryType === "in" ? "+" : "-"

  return `${prefix}${formatCurrency(entry.amount)}`
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
  const normalizedValue = parseCurrencyInput(rawValue)

  if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) {
    throw new Error("INVALID_AMOUNT")
  }

  return normalizedValue
}

function parseOptionalPositiveAmount(rawValue: string) {
  if (!hasCurrencyInputValue(rawValue)) {
    return null
  }

  const normalizedValue = parseCurrencyInput(rawValue)

  if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) {
    throw new Error("INVALID_TARGET_AMOUNT")
  }

  return normalizedValue
}

function isPositiveAmountInput(rawValue: string) {
  return parseCurrencyInput(rawValue) > 0
}

function isOptionalPositiveAmountInput(rawValue: string) {
  if (!hasCurrencyInputValue(rawValue)) {
    return true
  }

  return parseCurrencyInput(rawValue) > 0
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
    return "Informe um valor positivo para a movimentação."
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

  if (message === "INVALID_PAYMENT_METHOD") {
    return "Escolha dinheiro, Pix ou débito para registrar o resgate."
  }

  if (message === "RESERVE_INSUFFICIENT_FUNDS") {
    return "O resgate não pode passar do saldo disponível nesta caixinha."
  }

  if (message === "RESERVE_ARCHIVED") {
    return "Esta caixinha foi arquivada e não aceita novas movimentações."
  }

  if (message === "RESERVE_BALANCE_NOT_ZERO") {
    return "Zere o saldo antes de arquivar esta caixinha."
  }

  if (message === "RESERVE_CATEGORY_NOT_FOUND") {
    return "A categoria de sistema Reserva não foi encontrada para concluir a movimentação."
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