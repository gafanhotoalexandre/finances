import * as React from "react"
import {
  useNavigation,
  useRevalidator,
  useRouteLoaderData,
  useSearchParams,
} from "react-router"
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  CalendarDaysIcon,
  Clock3Icon,
  DownloadIcon,
  FileSpreadsheetIcon,
  LockIcon,
  LoaderCircleIcon,
  MinusIcon,
  PlusIcon,
  Trash2Icon,
  WalletIcon,
} from "lucide-react"

import { getFriendlyErrorMessage } from "@/lib/auth"
import {
  addMonthsToOccurredOn,
  createTransactions,
  deleteTransaction,
  formatInstallmentDescription,
  formatMonthLabel,
  getAllTransactionsForExport,
  getCurrentAppYear,
  getCurrentMonthParam,
  getCurrentOccurredOn,
  isReserveSystemCategory,
  updateTransaction,
  type FinanceCategory,
  type FinanceTransaction,
  type PaymentMethod,
  type TransactionMutationScope,
  type TransactionType,
  type UpdateTransactionInput,
} from "@/lib/finance"
import { cn, formatCurrencyInput, parseCurrencyInput } from "@/lib/utils"
import type { DashboardLoaderData } from "@/routes/data"
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
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type FeedbackState = {
  kind: "error" | "success"
  message: string
}

type PendingIntent = "create" | "update" | "delete" | null

type EditorMode = "create" | "edit"

type TransactionCreateDefaults = Pick<
  TransactionFormState,
  "paymentMethod" | "transactionType"
>

type ScopeRequestState =
  | {
      action: "delete"
      transaction: FinanceTransaction
    }
  | {
      action: "save"
      transaction: FinanceTransaction
      values: UpdateTransactionInput
    }

type DeleteConfirmationState = {
  scope: TransactionMutationScope
  transaction: FinanceTransaction
}

type MonthOption = {
  label: string
  value: string
}

type ExportScope = "history" | "month"

type TransactionFormState = {
  amount: string
  categoryId: string
  description: string
  occurredOn: string
  paymentMethod: PaymentMethod
  repeatMonths: string
  transactionType: TransactionType
}

type PaymentMethodFilter = PaymentMethod | "all"

const DEFAULT_CREATE_DEFAULTS = {
  paymentMethod: "cash",
  transactionType: "out",
} satisfies TransactionCreateDefaults

const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
})

const OCCURRED_ON_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
})

const TRANSACTION_TYPE_COPY: Record<
  TransactionType,
  { helper: string; label: string }
> = {
  in: {
    helper: "Mostra apenas categorias compatíveis com lançamentos de entrada.",
    label: "Entrada",
  },
  out: {
    helper: "Mostra apenas categorias compatíveis com lançamentos de saída.",
    label: "Saída",
  },
}

const PAYMENT_METHOD_COPY: Record<
  PaymentMethod,
  {
    badgeClassName: string
    label: string
    shortLabel: string
  }
> = {
  cash: {
    badgeClassName:
      "border-slate-200/80 bg-slate-50/85 text-slate-700 dark:border-slate-700/70 dark:bg-slate-950/55 dark:text-slate-200",
    label: "Dinheiro",
    shortLabel: "Dinheiro",
  },
  credit_card: {
    badgeClassName:
      "border-amber-200/80 bg-amber-50/85 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200",
    label: "Cartão de Crédito",
    shortLabel: "Crédito",
  },
  debit: {
    badgeClassName:
      "border-sky-200/80 bg-sky-50/85 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-200",
    label: "Debito",
    shortLabel: "Debito",
  },
  pix: {
    badgeClassName:
      "border-emerald-200/80 bg-emerald-50/85 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200",
    label: "Pix",
    shortLabel: "Pix",
  },
}

export function DashboardPage() {
  const loaderData = useRouteLoaderData<DashboardLoaderData>("dashboard")

  if (!loaderData) {
    throw new Error("DASHBOARD_LOADER_MISSING")
  }

  const dashboardData = loaderData

  const navigation = useNavigation()
  const revalidator = useRevalidator()
  const [searchParams, setSearchParams] = useSearchParams()
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [editorMode, setEditorMode] = React.useState<EditorMode>("create")
  const [editingTransactionId, setEditingTransactionId] =
    React.useState<string | null>(null)
  const [feedback, setFeedback] = React.useState<FeedbackState | null>(null)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [pendingIntent, setPendingIntent] = React.useState<PendingIntent>(null)
  const [paymentMethodFilter, setPaymentMethodFilter] =
    React.useState<PaymentMethodFilter>("all")
  const [exportScope, setExportScope] = React.useState<ExportScope | null>(null)
  const [scopeRequest, setScopeRequest] =
    React.useState<ScopeRequestState | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] =
    React.useState<DeleteConfirmationState | null>(null)
  const [smartDefaults, setSmartDefaults] =
    React.useState<TransactionCreateDefaults>(DEFAULT_CREATE_DEFAULTS)
  const [isMonthTransitionPending, startMonthTransition] = React.useTransition()
  const [formState, setFormState] = React.useState(() =>
    createTransactionFormState(loaderData.month, DEFAULT_CREATE_DEFAULTS)
  )

  const editingTransaction = React.useMemo(() => {
    if (editorMode !== "edit") {
      return null
    }

    return (
      loaderData.transactions.find(
        (transaction) => transaction.id === editingTransactionId
      ) ?? null
    )
  }, [editorMode, editingTransactionId, loaderData.transactions])
  const isEditing = editorMode === "edit" && editingTransaction !== null

  const filteredCategories = React.useMemo(
    () => filterCategories(loaderData.categories, formState.transactionType),
    [loaderData.categories, formState.transactionType]
  )
  const reserveSystemCategoryId = React.useMemo(
    () =>
      loaderData.categories.find((category) => isReserveSystemCategory(category))
        ?.id ?? null,
    [loaderData.categories]
  )
  const normalizedFormState = React.useMemo(
    () =>
      normalizeFormState(formState, {
        filteredCategories,
        mode: editorMode,
        month: loaderData.month,
      }),
    [editorMode, filteredCategories, formState, loaderData.month]
  )
  const visibleTransactions = React.useMemo(
    () =>
      filterTransactionsByPaymentMethod(
        loaderData.transactions,
        paymentMethodFilter
      ),
    [loaderData.transactions, paymentMethodFilter]
  )
  const activePaymentMethod =
    paymentMethodFilter === "all" ? null : paymentMethodFilter
  const creditCardInvoiceTotal = React.useMemo(
    () =>
      activePaymentMethod === "credit_card"
        ? visibleTransactions.reduce((sum, transaction) => {
            if (transaction.transactionType !== "out") {
              return sum
            }

            return sum + transaction.amount
          }, 0)
        : null,
    [activePaymentMethod, visibleTransactions]
  )
  const monthOptions = React.useMemo(
    () => buildMonthOptions(),
    []
  )
  const selectedMonthValue = monthOptions.some(
    (option) => option.value === loaderData.month
  )
    ? loaderData.month
    : undefined
  const isMonthNavigating =
    isMonthTransitionPending ||
    (navigation.state !== "idle" && navigation.location?.pathname === "/dashboard")
  const isRevalidating = revalidator.state !== "idle"
  const isSubmitting = pendingIntent === "create" || pendingIntent === "update"
  const isDeleting = pendingIntent === "delete"
  const isExporting = exportScope !== null

  function isReserveLedgerTransaction(transaction: FinanceTransaction) {
    return (
      reserveSystemCategoryId !== null &&
      transaction.categoryId === reserveSystemCategoryId
    )
  }

  function handleMonthChange(nextMonth: string) {
    resetToCreateEditor({ closeDrawer: true })

    startMonthTransition(() => {
      const nextSearchParams = new URLSearchParams(searchParams)
      nextSearchParams.set("month", nextMonth)
      setSearchParams(nextSearchParams)
    })
  }

  function resetToCreateEditor(options?: {
    closeDrawer?: boolean
    defaults?: TransactionCreateDefaults
  }) {
    const nextDefaults = options?.defaults ?? smartDefaults

    setDeleteConfirmation(null)
    setScopeRequest(null)
    setEditorMode("create")
    setEditingTransactionId(null)
    setFormError(null)
    setFormState(createTransactionFormState(dashboardData.month, nextDefaults))

    if (options?.closeDrawer) {
      setDrawerOpen(false)
    }
  }

  function handleDrawerOpenChange(open: boolean) {
    setDrawerOpen(open)

    if (!open) {
      setDeleteConfirmation(null)
      setFormError(null)
      setScopeRequest(null)
      setEditorMode("create")
      setEditingTransactionId(null)
      setFormState(createTransactionFormState(dashboardData.month, smartDefaults))
    }
  }

  function openEditorForTransaction(transaction: FinanceTransaction) {
    if (isReserveLedgerTransaction(transaction)) {
      return
    }

    setDeleteConfirmation(null)
    setFormError(null)
    setScopeRequest(null)
    setEditorMode("edit")
    setEditingTransactionId(transaction.id)
    setFormState(createEditTransactionFormState(transaction))

    if (shouldUseMobileDrawer()) {
      setDrawerOpen(true)
      return
    }

    setDrawerOpen(false)
  }

  function updateFormField<Key extends keyof TransactionFormState>(
    field: Key,
    value: TransactionFormState[Key]
  ) {
    setFormError(null)
    setFormState((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function runCreate(
    entries: ReturnType<typeof buildRecurringTransactions>
  ) {
    setPendingIntent("create")

    try {
      await createTransactions(entries)

      const nextDefaults = {
        paymentMethod: normalizedFormState.paymentMethod,
        transactionType: normalizedFormState.transactionType,
      } satisfies TransactionCreateDefaults
      const plural = entries.length > 1 ? "s" : ""

      setFeedback({
        kind: "success",
        message: `${entries.length} lançamento${plural} salvo${plural} com sucesso.`,
      })
      setSmartDefaults(nextDefaults)
      resetToCreateEditor({ closeDrawer: true, defaults: nextDefaults })
      revalidator.revalidate()
    } catch (error) {
      setFormError(
        getFriendlyErrorMessage(
          error,
          "Não foi possível salvar as transações agora."
        )
      )
    } finally {
      setPendingIntent(null)
    }
  }

  async function runUpdate(
    transaction: FinanceTransaction,
    values: UpdateTransactionInput,
    scope: TransactionMutationScope
  ) {
    setPendingIntent("update")

    try {
      await updateTransaction({
        scope,
        targetOccurredOn: transaction.occurredOn,
        targetRecurrenceGroupId: transaction.recurrenceGroupId,
        transactionId: transaction.id,
        values,
      })

      setFeedback({
        kind: "success",
        message:
          scope === "single"
            ? "Lançamento atualizado com sucesso."
            : "Lançamento e recorrências futuras atualizados com sucesso. As datas originais foram preservadas.",
      })
      setScopeRequest(null)
      resetToCreateEditor({ closeDrawer: true })
      revalidator.revalidate()
    } catch (error) {
      setFormError(
        getFriendlyErrorMessage(
          error,
          "Não foi possível atualizar o lançamento agora."
        )
      )
    } finally {
      setPendingIntent(null)
    }
  }

  async function runDelete(
    transaction: FinanceTransaction,
    scope: TransactionMutationScope
  ) {
    setPendingIntent("delete")

    try {
      await deleteTransaction({
        scope,
        targetOccurredOn: transaction.occurredOn,
        targetRecurrenceGroupId: transaction.recurrenceGroupId,
        transactionId: transaction.id,
      })

      setFeedback({
        kind: "success",
        message:
          scope === "single"
            ? "Lançamento removido permanentemente."
            : "Lançamento selecionado e recorrências futuras removidos permanentemente.",
      })
      setDeleteConfirmation(null)
      setScopeRequest(null)
      resetToCreateEditor({ closeDrawer: true })
      revalidator.revalidate()
    } catch (error) {
      setFeedback({
        kind: "error",
        message: getFriendlyErrorMessage(
          error,
          "Não foi possível excluir o lançamento agora."
        ),
      })
    } finally {
      setPendingIntent(null)
    }
  }

  async function handleSubmitTransactions(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)
    setFormError(null)

    if (editorMode === "edit" && !editingTransaction) {
      resetToCreateEditor()
      return
    }

    if (isEditing && editingTransaction) {
      let values

      try {
        values = buildUpdateTransactionInput(normalizedFormState)
      } catch (error) {
        setFormError(
          getFriendlyErrorMessage(
            error,
            "Revise descrição, valor, categoria, data e meio antes de salvar."
          )
        )
        return
      }

      if (editingTransaction.recurrenceGroupId) {
        setScopeRequest({
          action: "save",
          transaction: editingTransaction,
          values,
        })
        return
      }

      await runUpdate(editingTransaction, values, "single")
      return
    }

    let entries

    try {
      entries = buildRecurringTransactions(
        normalizedFormState,
        dashboardData.workspaceId
      )
    } catch (error) {
      setFormError(
        getFriendlyErrorMessage(
          error,
          "Revise descrição, valor, categoria, data e repetição antes de salvar."
        )
      )
      return
    }

    await runCreate(entries)
  }

  async function handleScopeSave(scope: TransactionMutationScope) {
    if (!scopeRequest || scopeRequest.action !== "save") {
      return
    }

    const { transaction, values } = scopeRequest

    setScopeRequest(null)
    await runUpdate(transaction, values, scope)
  }

  function handleScopeDelete(scope: TransactionMutationScope) {
    if (!scopeRequest || scopeRequest.action !== "delete") {
      return
    }

    setDeleteConfirmation({
      scope,
      transaction: scopeRequest.transaction,
    })
    setScopeRequest(null)
  }

  function handleRequestDelete(transaction: FinanceTransaction) {
    if (isReserveLedgerTransaction(transaction)) {
      return
    }

    setFeedback(null)
    setFormError(null)

    if (transaction.recurrenceGroupId) {
      setScopeRequest({
        action: "delete",
        transaction,
      })
      return
    }

    setDeleteConfirmation({
      scope: "single",
      transaction,
    })
  }

  function handleTransactionCardKeyDown(
    event: React.KeyboardEvent<HTMLElement>,
    transaction: FinanceTransaction
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return
    }

    event.preventDefault()
    openEditorForTransaction(transaction)
  }

  async function handleExportTransactions(scope: ExportScope) {
    setFeedback(null)
    setExportScope(scope)

    try {
      const transactions =
        scope === "month"
          ? dashboardData.transactions
          : await getAllTransactionsForExport()

      const csvContent = buildTransactionsCsv(
        transactions,
        dashboardData.categories
      )

      downloadCsvFile(
        scope === "month"
          ? `project-finance-${dashboardData.month}.csv`
          : "project-finance-historico.csv",
        csvContent
      )

      setFeedback({
        kind: "success",
        message:
          scope === "month"
            ? `CSV de ${dashboardData.monthLabel} exportado com sucesso.`
            : "CSV do histórico completo exportado com sucesso.",
      })
    } catch (error) {
      setFeedback({
        kind: "error",
        message: getFriendlyErrorMessage(
          error,
          "Não foi possível exportar o CSV agora."
        ),
      })
    } finally {
      setExportScope(null)
    }
  }

  return (
    <>
      <section className="w-full min-w-0 rounded-[28px] py-4">
        <div className="flex flex-col gap-5 lg:gap-6">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] font-medium tracking-[0.24em] uppercase text-slate-500 dark:text-slate-400">
                Painel mensal
              </span>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-800 sm:text-3xl dark:text-slate-50">
                    Fluxo de caixa
                  </h2>
                  <Badge
                    variant="outline"
                    className="glass-card border-white/65 bg-white/72 text-[11px] tracking-[0.18em] uppercase text-slate-700 dark:border-slate-700/70 dark:bg-slate-950/60 dark:text-slate-200"
                  >
                    Overview
                  </Badge>
                </div>
                <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Saldo herdado, movimentos do mês e caixa atual numa leitura cronológica mais fiel ao fluxo de caixa real.
                </p>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
              <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[220px_auto] sm:items-end">
                <div className="flex w-full flex-col gap-1.5 sm:w-auto">
                  <span className="px-1 font-mono text-[10px] font-medium tracking-[0.2em] uppercase text-slate-500 dark:text-slate-400">
                    Mês
                  </span>
                  <div className="glass-card flex h-11 w-full items-center gap-2 rounded-2xl border-white/60 px-3 sm:w-55 dark:border-slate-700/75 dark:bg-slate-950/58">
                    <CalendarDaysIcon className="size-4 text-slate-500 dark:text-slate-300" />
                    <Select value={selectedMonthValue} onValueChange={handleMonthChange}>
                      <SelectTrigger className="h-auto w-full border-0 bg-transparent px-0 py-0 pr-0 text-left shadow-none focus-visible:ring-0 dark:bg-transparent">
                        <SelectValue placeholder={loaderData.monthLabel} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {monthOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full rounded-2xl border-white/60 bg-white/65 sm:w-auto dark:border-slate-700/70 dark:bg-slate-950/58"
                      disabled={isExporting}
                    >
                      {isExporting ? (
                        <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
                      ) : (
                        <DownloadIcon data-icon="inline-start" />
                      )}
                      Exportar CSV
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[18rem]">
                    <DropdownMenuLabel>Exportação</DropdownMenuLabel>
                    <DropdownMenuItem
                      disabled={isExporting}
                      onSelect={(event) => {
                        event.preventDefault()
                        void handleExportTransactions("month")
                      }}
                    >
                      <FileSpreadsheetIcon className="size-4" />
                      <div className="flex flex-col gap-0.5">
                        <span>Exportar mês atual</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Baixa todos os lançamentos de {loaderData.monthLabel}.
                        </span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={isExporting}
                      onSelect={(event) => {
                        event.preventDefault()
                        void handleExportTransactions("history")
                      }}
                    >
                      <DownloadIcon className="size-4" />
                      <div className="flex flex-col gap-0.5">
                        <span>Exportar histórico completo</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Busca todo o ledger disponível para auditoria externa.
                        </span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 md:gap-4">
            <SummaryMetricCard
              accent={
                loaderData.summary.previousBalance > 0
                  ? "emerald"
                  : loaderData.summary.previousBalance < 0
                    ? "rose"
                    : "slate"
              }
              icon={Clock3Icon}
              label="Saldo anterior"
              value={loaderData.summary.previousBalance}
            />
            <SummaryMetricCard
              accent="emerald"
              icon={ArrowUpRightIcon}
              label="Entradas"
              value={loaderData.summary.totalIn}
            />
            <SummaryMetricCard
              accent="rose"
              icon={ArrowDownRightIcon}
              label="Saídas"
              value={loaderData.summary.totalOut}
            />
            <BalanceMetricCard value={loaderData.summary.currentBalance} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_360px] lg:gap-8">
            <section className="flex min-w-0 flex-col gap-3">
              <div className="flex items-center justify-between gap-3 px-1">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Lançamentos do mês
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {loaderData.monthLabel} · clique ou toque para editar
                  </p>
                </div>
                <div className="flex w-full flex-col items-stretch gap-2 text-[11px] text-slate-500 sm:w-auto sm:flex-row sm:items-center sm:justify-end dark:text-slate-400">
                  {isMonthNavigating || isRevalidating ? (
                    <Badge
                      variant="outline"
                      className="gap-1 border-slate-200/80 bg-white/78 dark:border-slate-700/80 dark:bg-slate-950/62"
                    >
                      <LoaderCircleIcon className="animate-spin" />
                      Sincronizando
                    </Badge>
                  ) : null}
                  <div className="glass-card flex h-9 w-full items-center gap-2 rounded-2xl border-white/60 px-3 sm:w-47.5 dark:border-slate-700/75 dark:bg-slate-950/58">
                    <Select
                      value={paymentMethodFilter}
                      onValueChange={(value) =>
                        setPaymentMethodFilter(value as PaymentMethodFilter)
                      }
                    >
                      <SelectTrigger
                        aria-label="Filtrar por meio de pagamento"
                        className="h-auto w-full border-0 bg-transparent px-0 py-0 pr-0 text-left shadow-none focus-visible:ring-0 dark:bg-transparent"
                        id="dashboard-payment-method-filter"
                      >
                        <SelectValue placeholder="Todos os meios" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">Todos os meios</SelectItem>
                          {Object.entries(PAYMENT_METHOD_COPY).map(
                            ([value, methodCopy]) => (
                              <SelectItem key={value} value={value}>
                                {methodCopy.label}
                              </SelectItem>
                            )
                          )}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="font-mono uppercase tracking-[0.18em]">
                    {activePaymentMethod
                      ? `${visibleTransactions.length} de ${loaderData.summary.transactionCount} registros`
                      : `${loaderData.summary.transactionCount} registros`}
                  </span>
                  {creditCardInvoiceTotal !== null ? (
                    <Badge
                      variant="outline"
                      className="h-auto justify-center border-amber-200/85 bg-amber-50/85 px-3 py-2 text-[10px] font-semibold tracking-[0.16em] uppercase text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200"
                    >
                      Total da fatura: {BRL_FORMATTER.format(creditCardInvoiceTotal)}
                    </Badge>
                  ) : null}
                </div>
              </div>

              {loaderData.transactions.length === 0 ? (
                <Card className="glass-card rounded-[24px] border-white/55 bg-white/72 py-0 dark:border-slate-700/70 dark:bg-slate-950/55">
                  <CardHeader className="px-5 pt-5">
                    <CardTitle>Sem movimentos neste mês.</CardTitle>
                    <CardDescription>
                      Ainda não existem entradas ou saídas persistidas em {loaderData.monthLabel}. O caixa atual continua refletindo o saldo acumulado até o fechamento do mês anterior.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 px-5 pb-5">
                    <div className="rounded-2xl border border-dashed border-slate-300/80 bg-slate-50/70 px-4 py-4 text-sm text-slate-600 dark:border-slate-600/60 dark:bg-slate-900/40 dark:text-slate-300">
                      Esta fase não inventa projeções. O dashboard cruza saldo anterior, movimentos do mês e caixa atual usando apenas dados reais que já vivem em <span className="font-mono">public.transactions</span>.
                    </div>
                    <Button
                      type="button"
                      className="dashboard-cta lg:hidden"
                      onClick={() => {
                        resetToCreateEditor()
                        setDrawerOpen(true)
                      }}
                    >
                      <PlusIcon data-icon="inline-end" />
                      Criar primeiro lançamento
                    </Button>
                  </CardContent>
                </Card>
              ) : visibleTransactions.length === 0 && activePaymentMethod ? (
                <Card className="glass-card rounded-[24px] border-white/55 bg-white/72 py-0 dark:border-slate-700/70 dark:bg-slate-950/55">
                  <CardHeader className="px-5 pt-5">
                    <CardTitle>
                      Nenhum lançamento em {PAYMENT_METHOD_COPY[activePaymentMethod].label} neste mês.
                    </CardTitle>
                    <CardDescription>
                      Existem movimentos em {loaderData.monthLabel}, mas o filtro atual está mostrando apenas um recorte do fluxo.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex px-5 pb-5">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => setPaymentMethodFilter("all")}
                    >
                      Ver todos os meios
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {visibleTransactions.map((transaction, index) => {
                    const isReserveLocked = isReserveLedgerTransaction(transaction)

                    return (
                      <article
                        key={transaction.id}
                        aria-label={
                          isReserveLocked
                            ? `${transaction.description} protegido pelo Cofre`
                            : `Editar ${transaction.description}`
                        }
                        role={isReserveLocked ? undefined : "button"}
                        tabIndex={isReserveLocked ? undefined : 0}
                        className={cn(
                          "glass-card animate-transaction-row flex items-center justify-between gap-3 rounded-[18px] border-white/55 px-3.5 py-3 text-left outline-none transition-[border-color,box-shadow,transform] dark:border-slate-700/70 dark:bg-slate-950/55",
                          isReserveLocked
                            ? "cursor-default border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,251,235,0.94),rgba(255,255,255,0.88),rgba(238,242,255,0.88))] shadow-[0_22px_38px_-30px_rgba(120,53,15,0.22)] dark:border-amber-400/20 dark:bg-[linear-gradient(135deg,rgba(120,53,15,0.18),rgba(15,23,42,0.92),rgba(49,46,129,0.16))]"
                            : "hover:-translate-y-0.5 hover:border-slate-200/90 hover:shadow-[0_22px_36px_-30px_rgba(15,23,42,0.42)] focus-visible:border-slate-400/80 focus-visible:ring-2 focus-visible:ring-slate-300/50 dark:hover:border-slate-600/85 dark:hover:shadow-[0_24px_40px_-32px_rgba(2,6,23,0.75)] dark:focus-visible:border-slate-500/80 dark:focus-visible:ring-slate-500/30",
                          !isReserveLocked &&
                            isEditing &&
                            editingTransaction?.id === transaction.id
                            ? "border-indigo-200/90 bg-white/82 shadow-[0_24px_40px_-32px_rgba(99,102,241,0.28)] dark:border-indigo-400/40 dark:bg-slate-950/70"
                            : null
                        )}
                        style={
                          {
                            "--transaction-enter-delay": `${Math.min(index * 45, 320)}ms`,
                          } as React.CSSProperties
                        }
                        onClick={
                          isReserveLocked
                            ? undefined
                            : () => openEditorForTransaction(transaction)
                        }
                        onKeyDown={
                          isReserveLocked
                            ? undefined
                            : (event) =>
                                handleTransactionCardKeyDown(event, transaction)
                        }
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-xl",
                              isReserveLocked
                                ? "bg-amber-100/90 text-amber-700 dark:bg-amber-500/14 dark:text-amber-200"
                                : transaction.transactionType === "in"
                                ? "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                                : "bg-slate-200/80 text-slate-500 dark:bg-slate-800/80 dark:text-slate-300"
                            )}
                          >
                            {transaction.transactionType === "in" ? (
                              <PlusIcon className="size-4" />
                            ) : (
                              <MinusIcon className="size-4" />
                            )}
                          </div>

                          <div className="flex min-w-0 flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                                {transaction.description}
                              </span>
                              {transaction.recurrenceGroupId ? (
                                <Badge
                                  variant="secondary"
                                  className="font-mono text-[10px] tracking-[0.14em] uppercase"
                                >
                                  Recorrente
                                </Badge>
                              ) : null}
                              {isReserveLocked ? (
                                <Badge
                                  variant="outline"
                                  className="gap-1 border-amber-200/80 bg-amber-50/85 text-[10px] tracking-[0.14em] uppercase text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200"
                                >
                                  <LockIcon className="size-3" />
                                  Cofre
                                </Badge>
                              ) : null}
                              {!isReserveLocked &&
                              isEditing &&
                              editingTransaction?.id === transaction.id ? (
                                <Badge
                                  variant="outline"
                                  className="border-indigo-200/80 bg-indigo-50/85 text-[10px] tracking-[0.14em] uppercase text-indigo-700 dark:border-indigo-400/35 dark:bg-indigo-500/10 dark:text-indigo-200"
                                >
                                  Em edição
                                </Badge>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              <span>
                                {resolveCategoryName(
                                  loaderData.categories,
                                  transaction.categoryId
                                )}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "h-6 border text-[10px] font-semibold tracking-[0.14em] uppercase",
                                  PAYMENT_METHOD_COPY[transaction.paymentMethod]
                                    .badgeClassName
                                )}
                              >
                                {
                                  PAYMENT_METHOD_COPY[transaction.paymentMethod]
                                    .shortLabel
                                }
                              </Badge>
                              <span className="font-mono uppercase tracking-[0.16em]">
                                {formatOccurredOn(transaction.occurredOn)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={cn(
                              "font-mono text-sm font-semibold tracking-tight",
                              transaction.transactionType === "in"
                                ? "text-emerald-600 dark:text-emerald-300"
                                : "text-slate-700 dark:text-slate-200"
                            )}
                          >
                            {transaction.transactionType === "in" ? "+" : "-"}{" "}
                            {BRL_FORMATTER.format(transaction.amount)}
                          </span>

                          {isReserveLocked ? (
                            <div className="flex items-center gap-1 rounded-2xl border border-white/60 bg-white/72 px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] uppercase text-slate-500 dark:border-slate-700/70 dark:bg-slate-950/58 dark:text-slate-300">
                              <LockIcon className="size-3.5" />
                              Imutável
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100"
                              aria-label={`Excluir ${transaction.description}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleRequestDelete(transaction)
                              }}
                            >
                              <Trash2Icon data-icon="inline-end" />
                            </Button>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            <aside className="hidden lg:block">
              <div className="glass-card sticky top-6 rounded-[24px] border-white/55 p-5 dark:border-slate-700/70 dark:bg-slate-950/55">
                <TransactionEntryForm
                  editorMode={isEditing ? "edit" : "create"}
                  errorMessage={formError}
                  filteredCategories={filteredCategories}
                  formState={normalizedFormState}
                  isRecurringEdit={Boolean(editingTransaction?.recurrenceGroupId)}
                  isSubmitting={isSubmitting}
                  monthLabel={loaderData.monthLabel}
                  onResetEditor={() => resetToCreateEditor()}
                  onSubmit={handleSubmitTransactions}
                  onValueChange={updateFormField}
                />
              </div>
            </aside>
          </div>
        </div>
      </section>

      <Drawer
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
      >
        <DrawerTrigger asChild>
          <Button
            className="dashboard-fab fixed right-5 bottom-24 z-40 size-14 rounded-full lg:hidden"
            onClick={() => resetToCreateEditor()}
          >
            <PlusIcon />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="bg-white/98 dark:bg-slate-950/98 lg:hidden">
          <DrawerHeader>
            <DrawerTitle>
              {isEditing ? "Editar lançamento" : "Novo lançamento"}
            </DrawerTitle>
            <DrawerDescription>
              {isEditing
                ? "Ajuste o lançamento selecionado e deixe a escolha de alcance para a etapa seguinte quando ele fizer parte de uma recorrência."
                : "Crie entradas ou saídas reais em lote, mantendo o mês dirigido pela URL e a recorrência agrupada no mesmo envio."}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-5">
            <TransactionEntryForm
              editorMode={isEditing ? "edit" : "create"}
              errorMessage={formError}
              filteredCategories={filteredCategories}
              formState={normalizedFormState}
              isRecurringEdit={Boolean(editingTransaction?.recurrenceGroupId)}
              isSubmitting={isSubmitting}
              monthLabel={loaderData.monthLabel}
              onResetEditor={() => resetToCreateEditor()}
              onSubmit={handleSubmitTransactions}
              onValueChange={updateFormField}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog
        open={Boolean(scopeRequest)}
        onOpenChange={(open) => {
          if (!open) {
            setScopeRequest(null)
          }
        }}
      >
        <AlertDialogContent className="glass-card border-white/70 bg-white/95 shadow-[0_26px_60px_-36px_rgba(15,23,42,0.5)] dark:border-slate-700/75 dark:bg-slate-950/90">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:text-slate-200">
              <CalendarDaysIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {scopeRequest?.action === "save"
                ? "Como aplicar esta edição?"
                : "Qual alcance você quer excluir?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {getScopeRequestDescription(scopeRequest)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr_1fr]">
            <AlertDialogCancel disabled={pendingIntent !== null}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              disabled={pendingIntent !== null}
              onClick={() => {
                if (scopeRequest?.action === "save") {
                  void handleScopeSave("single")
                  return
                }

                handleScopeDelete("single")
              }}
            >
              Apenas este lançamento
            </AlertDialogAction>
            <AlertDialogAction
              disabled={pendingIntent !== null}
              onClick={() => {
                if (scopeRequest?.action === "save") {
                  void handleScopeSave("this-and-future")
                  return
                }

                handleScopeDelete("this-and-future")
              }}
            >
              Este e os futuros
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deleteConfirmation)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteConfirmation(null)
          }
        }}
      >
        <AlertDialogContent className="glass-card border-white/70 bg-white/95 shadow-[0_26px_60px_-36px_rgba(15,23,42,0.5)] dark:border-slate-700/75 dark:bg-slate-950/90">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:text-slate-200">
              <Trash2Icon />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {deleteConfirmation?.scope === "this-and-future"
                ? "Excluir este lançamento e os futuros?"
                : "Excluir lançamento permanentemente?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {getDeleteConfirmationDescription(deleteConfirmation)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={() => {
                if (!deleteConfirmation) {
                  return
                }

                void runDelete(
                  deleteConfirmation.transaction,
                  deleteConfirmation.scope
                )
              }}
            >
              {isDeleting ? (
                <LoaderCircleIcon
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <Trash2Icon data-icon="inline-start" />
              )}
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

type SummaryMetricCardProps = {
  accent: "emerald" | "rose" | "slate"
  icon: React.ComponentType<React.ComponentProps<"svg">>
  label: string
  value: number
}

function SummaryMetricCard({
  accent,
  icon: Icon,
  label,
  value,
}: SummaryMetricCardProps) {
  return (
    <Card className="glass-card rounded-[22px] border-white/55 bg-white/72 py-0 dark:border-slate-700/70 dark:bg-slate-950/55">
      <CardContent className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex min-w-0 flex-col gap-3">
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-500 dark:text-slate-400">
            {label}
          </span>
          <span className="font-mono text-lg font-semibold tracking-tight text-slate-800 sm:text-2xl dark:text-slate-50">
            {BRL_FORMATTER.format(value)}
          </span>
        </div>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            accent === "emerald"
              ? "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
              : accent === "rose"
                ? "bg-rose-100/80 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300"
                : "bg-slate-200/90 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300"
          )}
        >
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  )
}

function BalanceMetricCard({ value }: { value: number }) {
  return (
    <Card className="rounded-[22px] border border-slate-900/90 bg-slate-900 py-0 text-white shadow-[0_22px_40px_-28px_rgba(15,23,42,0.72)] dark:border-slate-800">
      <CardContent className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "size-2 rounded-full",
                value < 0 ? "bg-rose-400" : "bg-indigo-400"
              )}
            />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">
              Caixa atual
            </span>
          </div>
          <span className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
            {BRL_FORMATTER.format(value)}
          </span>
          <span className="text-xs leading-5 text-slate-400">
            Saldo anterior + entradas do mês - saídas do mês.
          </span>
        </div>
        <WalletIcon className="mt-1 size-4 shrink-0 text-slate-400" />
      </CardContent>
    </Card>
  )
}

type TransactionEntryFormProps = {
  editorMode: EditorMode
  errorMessage: string | null
  filteredCategories: FinanceCategory[]
  formState: TransactionFormState
  isRecurringEdit: boolean
  isSubmitting: boolean
  monthLabel: string
  onResetEditor: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onValueChange: <Key extends keyof TransactionFormState>(
    field: Key,
    value: TransactionFormState[Key]
  ) => void
}

function TransactionEntryForm({
  editorMode,
  errorMessage,
  filteredCategories,
  formState,
  isRecurringEdit,
  isSubmitting,
  monthLabel,
  onResetEditor,
  onSubmit,
  onValueChange,
}: TransactionEntryFormProps) {
  const isEditMode = editorMode === "edit"

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "size-2 rounded-full",
              isEditMode ? "bg-amber-500" : "bg-indigo-500"
            )}
          />
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">
              {isEditMode ? "Editar lançamento" : "Novo lançamento"}
            </h3>
            {isRecurringEdit ? (
              <Badge
                variant="outline"
                className="border-slate-200/80 bg-white/80 text-[10px] tracking-[0.14em] uppercase text-slate-600 dark:border-slate-700/80 dark:bg-slate-950/60 dark:text-slate-200"
              >
                Recorrente
              </Badge>
            ) : null}
          </div>
        </div>

        {isEditMode ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onResetEditor}
          >
            <PlusIcon data-icon="inline-start" />
            Novo
          </Button>
        ) : null}
      </div>

      <FieldSet>
        <FieldLegend>Dados do lançamento</FieldLegend>
        <FieldDescription>
          {isEditMode
            ? "Ajuste o lançamento selecionado. Se ele fizer parte de uma recorrência, a escolha entre apenas este item ou daqui para frente acontece na próxima etapa."
            : "O envio respeita o mês aberto, filtra categorias pelo tipo, permite repetir parcelas futuras e reaproveita o último tipo e meio salvos com sucesso."}
        </FieldDescription>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="transaction-description">Descrição</FieldLabel>
            <Input
              id="transaction-description"
              name="description"
              placeholder="Ex: Fatura do Cartão de crédito"
              value={formState.description}
              onChange={(event) => onValueChange("description", event.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="transaction-type">Tipo</FieldLabel>
              <Select
                value={formState.transactionType}
                onValueChange={(value) =>
                  onValueChange("transactionType", value as TransactionType)
                }
              >
                <SelectTrigger id="transaction-type" className="w-full">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="out">Saída</SelectItem>
                    <SelectItem value="in">Entrada</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                {TRANSACTION_TYPE_COPY[formState.transactionType].helper}
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="transaction-payment-method">
                Meio de pagamento
              </FieldLabel>
              <Select
                value={formState.paymentMethod}
                onValueChange={(value) =>
                  onValueChange("paymentMethod", value as PaymentMethod)
                }
              >
                <SelectTrigger id="transaction-payment-method" className="w-full">
                  <SelectValue placeholder="Selecione o meio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Object.entries(PAYMENT_METHOD_COPY).map(
                      ([value, methodCopy]) => (
                        <SelectItem key={value} value={value}>
                          {methodCopy.label}
                        </SelectItem>
                      )
                    )}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                Discrimina cartão, débito, Pix e dinheiro sem alterar a conta cronológica do caixa.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="transaction-amount">Valor (R$)</FieldLabel>
              <Input
                id="transaction-amount"
                name="amount"
                autoComplete="off"
                type="text"
                inputMode="numeric"
                placeholder="0,00"
                value={formState.amount}
                onChange={(event) =>
                  onValueChange("amount", formatCurrencyInput(event.target.value))
                }
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="transaction-occurred-on">Data</FieldLabel>
              <Input
                id="transaction-occurred-on"
                name="occurredOn"
                type="date"
                value={formState.occurredOn}
                onChange={(event) => onValueChange("occurredOn", event.target.value)}
              />
              <FieldDescription>
                {isEditMode && isRecurringEdit
                  ? "Se você escolher 'este e os futuros', cada parcela preserva a própria data atual."
                  : `O mês exibido hoje é ${monthLabel}.`}
              </FieldDescription>
            </Field>

            {!isEditMode ? (
              <Field>
                <FieldLabel htmlFor="transaction-repeat-months">
                  Repetir por X meses
                </FieldLabel>
                <Input
                  id="transaction-repeat-months"
                  name="repeatMonths"
                  type="number"
                  min="1"
                  step="1"
                  value={formState.repeatMonths}
                  onChange={(event) =>
                    onValueChange("repeatMonths", event.target.value)
                  }
                />
                <FieldDescription>
                  Se for maior que 1, o cliente gera o lote com o mesmo grupo de recorrência e já numera as parcelas automaticamente.
                </FieldDescription>
              </Field>
            ) : null}
          </div>

          <Field>
            <FieldLabel htmlFor="transaction-category">Categoria</FieldLabel>
            <Select
              value={formState.categoryId}
              onValueChange={(value) => onValueChange("categoryId", value)}
            >
              <SelectTrigger id="transaction-category" className="w-full">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {filteredCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>
              {TRANSACTION_TYPE_COPY[formState.transactionType].label} usa apenas categorias compatíveis com o escopo semeado no banco.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </FieldSet>

      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}

      <Button className="dashboard-cta w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? (
          <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
        ) : isEditMode ? (
          <CalendarDaysIcon data-icon="inline-start" />
        ) : (
          <PlusIcon data-icon="inline-start" />
        )}
        {isSubmitting
          ? isEditMode
            ? "Salvando edição..."
            : "Salvando lançamentos..."
          : isEditMode
            ? "Salvar alterações"
            : "Salvar lançamento"}
      </Button>
    </form>
  )
}

function createTransactionFormState(
  month: string,
  defaults: TransactionCreateDefaults = DEFAULT_CREATE_DEFAULTS
): TransactionFormState {
  return {
    amount: "",
    categoryId: "",
    description: "",
    occurredOn: getDefaultOccurredOn(month),
    paymentMethod: defaults.paymentMethod,
    repeatMonths: "1",
    transactionType: defaults.transactionType,
  }
}

function createEditTransactionFormState(
  transaction: FinanceTransaction
): TransactionFormState {
  return {
    amount: formatCurrencyInput(transaction.amount),
    categoryId: transaction.categoryId ?? "",
    description: transaction.description,
    occurredOn: transaction.occurredOn,
    paymentMethod: transaction.paymentMethod,
    repeatMonths: "1",
    transactionType: transaction.transactionType,
  }
}

function buildUpdateTransactionInput(
  formState: TransactionFormState
): UpdateTransactionInput {
  const description = formState.description.trim()
  const amount = parseCurrencyInput(formState.amount)

  if (description.length < 3) {
    throw new Error("A descrição precisa ter pelo menos 3 caracteres.")
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Informe um valor maior que zero.")
  }

  if (!formState.categoryId) {
    throw new Error("Selecione uma categoria antes de salvar.")
  }

  if (!formState.occurredOn) {
    throw new Error("Informe a data do lançamento.")
  }

  return {
    amount,
    categoryId: formState.categoryId,
    description,
    occurredOn: formState.occurredOn,
    paymentMethod: formState.paymentMethod,
    transactionType: formState.transactionType,
  }
}

function getDefaultOccurredOn(month: string) {
  if (month === getCurrentMonthParam()) {
    return getCurrentOccurredOn()
  }

  return `${month}-01`
}

function filterCategories(
  categories: FinanceCategory[],
  transactionType: TransactionType
) {
  return categories.filter(
    (category) =>
      !isReserveSystemCategory(category) &&
      (category.scope === transactionType || category.scope === "both")
  )
}

function buildMonthOptions(): MonthOption[] {
  const currentYear = getCurrentAppYear()
  const options: MonthOption[] = []

  for (let year = currentYear; year <= currentYear + 1; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const value = `${year}-${String(month).padStart(2, "0")}`

      options.push({
        label: formatMonthLabel(value),
        value,
      })
    }
  }

  return options
}

function filterTransactionsByPaymentMethod(
  transactions: FinanceTransaction[],
  paymentMethodFilter: PaymentMethodFilter
) {
  if (paymentMethodFilter === "all") {
    return transactions
  }

  return transactions.filter(
    (transaction) => transaction.paymentMethod === paymentMethodFilter
  )
}

function buildRecurringTransactions(
  formState: TransactionFormState,
  workspaceId: string
) {
  const values = buildUpdateTransactionInput(formState)
  const repeatMonths = Math.max(1, Number.parseInt(formState.repeatMonths, 10) || 1)

  const recurrenceGroupId = repeatMonths > 1 ? crypto.randomUUID() : null

  return Array.from({ length: repeatMonths }, (_, index) => ({
    amount: values.amount,
    categoryId: values.categoryId,
    description:
      repeatMonths > 1
        ? formatInstallmentDescription(values.description, index + 1, repeatMonths)
        : values.description,
    occurredOn: addMonthsToOccurredOn(values.occurredOn, index),
    paymentMethod: values.paymentMethod,
    recurrenceGroupId,
    transactionType: values.transactionType,
    workspaceId,
  }))
}

type NormalizeFormStateOptions = {
  filteredCategories: FinanceCategory[]
  mode: EditorMode
  month: string
}

function normalizeFormState(
  formState: TransactionFormState,
  { filteredCategories, mode, month }: NormalizeFormStateOptions
): TransactionFormState {
  const nextOccurredOn =
    mode === "create"
      ? formState.occurredOn.startsWith(month)
        ? formState.occurredOn
        : getDefaultOccurredOn(month)
      : formState.occurredOn || getDefaultOccurredOn(month)
  const nextCategoryId = filteredCategories.some(
    (category) => category.id === formState.categoryId
  )
    ? formState.categoryId
    : filteredCategories[0]?.id ?? ""

  if (
    nextOccurredOn === formState.occurredOn &&
    nextCategoryId === formState.categoryId
  ) {
    return formState
  }

  return {
    ...formState,
    categoryId: nextCategoryId,
    occurredOn: nextOccurredOn,
  }
}

function resolveCategoryName(
  categories: FinanceCategory[],
  categoryId: string | null
) {
  if (!categoryId) {
    return "Sem categoria"
  }

  return (
    categories.find((category) => category.id === categoryId)?.name ??
    "Categoria removida"
  )
}

function formatOccurredOn(date: string) {
  const [year, month, day] = date.split("-").map(Number)
  return OCCURRED_ON_FORMATTER.format(new Date(Date.UTC(year, month - 1, day)))
}

function buildTransactionsCsv(
  transactions: FinanceTransaction[],
  categories: FinanceCategory[]
) {
  const rows = transactions.map((transaction) => {
    const categoryName = resolveCategoryName(categories, transaction.categoryId)

    return [
      transaction.occurredOn,
      transaction.description,
      TRANSACTION_TYPE_COPY[transaction.transactionType].label,
      categoryName,
      PAYMENT_METHOD_COPY[transaction.paymentMethod].label,
      BRL_FORMATTER.format(transaction.amount),
      transaction.recurrenceGroupId ? "Sim" : "Nao",
    ]
      .map(escapeCsvValue)
      .join(";")
  })

  return [
    [
      "Data",
      "Descricao",
      "Tipo",
      "Categoria",
      "Meio de pagamento",
      "Valor",
      "Recorrente",
    ].join(";"),
    ...rows,
  ].join("\r\n")
}

function escapeCsvValue(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

function downloadCsvFile(fileName: string, content: string) {
  const blob = new Blob(["\uFEFF", content], {
    type: "text/csv;charset=utf-8;",
  })
  const downloadUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement("a")

  anchor.href = downloadUrl
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(downloadUrl)
}

function shouldUseMobileDrawer() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 1023px)").matches
  )
}

function getScopeRequestDescription(scopeRequest: ScopeRequestState | null) {
  if (!scopeRequest) {
    return "Escolha como aplicar esta ação na recorrência."
  }

  if (scopeRequest.action === "save") {
    return `"${scopeRequest.transaction.description}" faz parte de uma recorrência. Escolha se a edição vale só para este lançamento ou do item clicado em diante. No modo futuros, as datas já existentes de cada parcela são preservadas.`
  }

  return `"${scopeRequest.transaction.description}" faz parte de uma recorrência. Escolha se a exclusão vale só para este lançamento ou desta parcela em diante a partir de ${formatOccurredOn(scopeRequest.transaction.occurredOn)}. A confirmação final acontece na próxima etapa.`
}

function getDeleteConfirmationDescription(
  deleteConfirmation: DeleteConfirmationState | null
) {
  if (!deleteConfirmation) {
    return "Confirme a exclusão permanente deste lançamento."
  }

  if (deleteConfirmation.scope === "this-and-future") {
    return `"${deleteConfirmation.transaction.description}" e as parcelas futuras do mesmo grupo, a partir de ${formatOccurredOn(deleteConfirmation.transaction.occurredOn)}, serão removidos com hard delete. Essa ação não tem desfazer e impacta os totais imediatamente.`
  }

  return `"${deleteConfirmation.transaction.description}" será removido com hard delete. Essa ação não tem desfazer e já impacta os totais do mês imediatamente.`
}

export default DashboardPage