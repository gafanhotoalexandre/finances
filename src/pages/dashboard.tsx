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
  formatMonthLabel,
  getCurrentAppYear,
  getCurrentMonthParam,
  getCurrentOccurredOn,
  type FinanceCategory,
  type FinanceTransaction,
  type TransactionType,
} from "@/lib/finance"
import { cn } from "@/lib/utils"
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
import { Separator } from "@/components/ui/separator"

type FeedbackState = {
  kind: "error" | "success"
  message: string
}

type MonthOption = {
  label: string
  value: string
}

type TransactionFormState = {
  amount: string
  categoryId: string
  description: string
  occurredOn: string
  repeatMonths: string
  transactionType: TransactionType
}

const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
})

const OCCURRED_ON_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
})

const TRANSACTION_TYPE_COPY: Record<
  TransactionType,
  { helper: string; label: string }
> = {
  in: {
    helper: "Mostra categorias de entrada e reserva para manter o fechamento coerente.",
    label: "Entrada",
  },
  out: {
    helper: "Mostra categorias de saída e reserva para manter o fluxo de caixa limpo.",
    label: "Saída",
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
  const [feedback, setFeedback] = React.useState<FeedbackState | null>(null)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [pendingIntent, setPendingIntent] = React.useState<
    "create" | "delete" | null
  >(null)
  const [transactionToDelete, setTransactionToDelete] =
    React.useState<FinanceTransaction | null>(null)
  const [isMonthTransitionPending, startMonthTransition] = React.useTransition()
  const [formState, setFormState] = React.useState(() =>
    createTransactionFormState(loaderData.month)
  )

  const filteredCategories = React.useMemo(
    () => filterCategories(loaderData.categories, formState.transactionType),
    [loaderData.categories, formState.transactionType]
  )
  const normalizedFormState = React.useMemo(
    () => normalizeFormState(formState, loaderData.month, filteredCategories),
    [filteredCategories, formState, loaderData.month]
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
  const isCreating = pendingIntent === "create"
  const isDeleting = pendingIntent === "delete"

  function handleMonthChange(nextMonth: string) {
    startMonthTransition(() => {
      const nextSearchParams = new URLSearchParams(searchParams)
      nextSearchParams.set("month", nextMonth)
      setSearchParams(nextSearchParams)
    })
  }

  function updateFormField<Key extends keyof TransactionFormState>(
    field: Key,
    value: TransactionFormState[Key]
  ) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleCreateTransactions(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)
    setFormError(null)

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
          "Revise descricao, valor, categoria, data e repeticao antes de salvar."
        )
      )
      return
    }

    setPendingIntent("create")

    try {
      await createTransactions(entries)

      const plural = entries.length > 1 ? "s" : ""
      setFeedback({
        kind: "success",
        message: `${entries.length} lançamento${plural} salvo${plural} com sucesso.`,
      })
      setFormState(createTransactionFormState(dashboardData.month))
      setDrawerOpen(false)
      revalidator.revalidate()
    } catch (error) {
      setFormError(
        getFriendlyErrorMessage(
          error,
          "Nao foi possivel salvar as transacoes agora."
        )
      )
    } finally {
      setPendingIntent(null)
    }
  }

  async function handleConfirmDelete(
    event: React.MouseEvent<HTMLButtonElement>
  ) {
    event.preventDefault()

    if (!transactionToDelete) {
      return
    }

    setFeedback(null)
    setPendingIntent("delete")

    try {
      await deleteTransaction(transactionToDelete.id)
      setFeedback({
        kind: "success",
        message: "Lancamento removido permanentemente.",
      })
      setTransactionToDelete(null)
      revalidator.revalidate()
    } catch (error) {
      setFeedback({
        kind: "error",
        message: getFriendlyErrorMessage(
          error,
          "Nao foi possivel excluir o lancamento agora."
        ),
      })
    } finally {
      setPendingIntent(null)
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

            <div className="flex w-full flex-col gap-1.5 sm:w-auto">
              <span className="px-1 font-mono text-[10px] font-medium tracking-[0.2em] uppercase text-slate-500 dark:text-slate-400">
                Competência
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
                    {loaderData.monthLabel}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  {isMonthNavigating || isRevalidating ? (
                    <Badge
                      variant="outline"
                      className="gap-1 border-slate-200/80 bg-white/78 dark:border-slate-700/80 dark:bg-slate-950/62"
                    >
                      <LoaderCircleIcon className="animate-spin" />
                      Sincronizando
                    </Badge>
                  ) : null}
                  <span className="font-mono uppercase tracking-[0.18em]">
                    {loaderData.summary.transactionCount} registros
                  </span>
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
                      onClick={() => setDrawerOpen(true)}
                    >
                      <PlusIcon data-icon="inline-end" />
                      Criar primeiro lançamento
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {loaderData.transactions.map((transaction) => (
                    <article
                      key={transaction.id}
                      className="glass-card flex items-center justify-between gap-3 rounded-[18px] border-white/55 px-3.5 py-3 dark:border-slate-700/70 dark:bg-slate-950/55"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-xl",
                            transaction.transactionType === "in"
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
                              <Badge variant="secondary" className="font-mono text-[10px] tracking-[0.14em] uppercase">
                                Recorrente
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
                            <Separator orientation="vertical" className="h-3" />
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

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100"
                          aria-label={`Excluir ${transaction.description}`}
                          onClick={() => setTransactionToDelete(transaction)}
                        >
                          <Trash2Icon data-icon="inline-end" />
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <aside className="hidden lg:block">
              <div className="glass-card sticky top-6 rounded-[24px] border-white/55 p-5 dark:border-slate-700/70 dark:bg-slate-950/55">
                <TransactionEntryForm
                  errorMessage={formError}
                  filteredCategories={filteredCategories}
                  formState={normalizedFormState}
                  isSubmitting={isCreating}
                  monthLabel={loaderData.monthLabel}
                  onSubmit={handleCreateTransactions}
                  onValueChange={updateFormField}
                />
              </div>
            </aside>
          </div>
        </div>
      </section>

      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open)
          if (!open) {
            setFormError(null)
          }
        }}
      >
        <DrawerTrigger asChild>
          <Button className="dashboard-fab fixed right-5 bottom-5 z-40 size-14 rounded-full lg:hidden">
            <PlusIcon />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="bg-white/98 dark:bg-slate-950/98">
          <DrawerHeader>
            <DrawerTitle>Novo lançamento</DrawerTitle>
            <DrawerDescription>
              Crie entradas ou saídas reais em lote, mantendo o mês dirigido pela URL e a recorrência agrupada no mesmo envio.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-5">
            <TransactionEntryForm
              errorMessage={formError}
              filteredCategories={filteredCategories}
              formState={normalizedFormState}
              isSubmitting={isCreating}
              monthLabel={loaderData.monthLabel}
              onSubmit={handleCreateTransactions}
              onValueChange={updateFormField}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog
        open={Boolean(transactionToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setTransactionToDelete(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
              <Trash2Icon />
            </AlertDialogMedia>
            <AlertDialogTitle>Excluir lançamento permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              {transactionToDelete
                ? `"${transactionToDelete.description}" será removido com hard delete. Essa ação não tem desfazer e já impacta os totais do mês imediatamente.`
                : "Confirme a exclusão permanente deste lançamento."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={(event) => {
                void handleConfirmDelete(event)
              }}
            >
              {isDeleting ? (
                <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
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
  errorMessage: string | null
  filteredCategories: FinanceCategory[]
  formState: TransactionFormState
  isSubmitting: boolean
  monthLabel: string
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onValueChange: <Key extends keyof TransactionFormState>(
    field: Key,
    value: TransactionFormState[Key]
  ) => void
}

function TransactionEntryForm({
  errorMessage,
  filteredCategories,
  formState,
  isSubmitting,
  monthLabel,
  onSubmit,
  onValueChange,
}: TransactionEntryFormProps) {
  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      <div className="flex items-center gap-2.5">
        <div className="size-2 rounded-full bg-indigo-500" />
        <h3 className="text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">
          Novo lançamento
        </h3>
      </div>

      <FieldSet>
        <FieldLegend>Dados do lançamento</FieldLegend>
        <FieldDescription>
          O envio respeita o mês da competência, filtra categorias pelo tipo e permite repetir parcelas futuras no mesmo lote.
        </FieldDescription>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="transaction-description">Descrição</FieldLabel>
            <Input
              id="transaction-description"
              name="description"
              placeholder="Ex: Gasolina da Factor"
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
              <FieldLabel htmlFor="transaction-amount">Valor (R$)</FieldLabel>
              <Input
                id="transaction-amount"
                name="amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formState.amount}
                onChange={(event) => onValueChange("amount", event.target.value)}
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
                O mês exibido hoje é {monthLabel}.
              </FieldDescription>
            </Field>

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
                Se for maior que 1, o cliente gera o lote com o mesmo grupo de recorrência.
              </FieldDescription>
            </Field>
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
        ) : (
          <PlusIcon data-icon="inline-start" />
        )}
        {isSubmitting ? "Salvando lançamentos..." : "Salvar lançamento"}
      </Button>
    </form>
  )
}

function createTransactionFormState(month: string): TransactionFormState {
  return {
    amount: "",
    categoryId: "",
    description: "",
    occurredOn: getDefaultOccurredOn(month),
    repeatMonths: "1",
    transactionType: "out",
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
      category.scope === transactionType || category.scope === "both"
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

function buildRecurringTransactions(
  formState: TransactionFormState,
  workspaceId: string
) {
  const description = formState.description.trim()
  const amount = Number(formState.amount)
  const repeatMonths = Math.max(1, Number.parseInt(formState.repeatMonths, 10) || 1)

  if (description.length < 3) {
    throw new Error("A descricao precisa ter pelo menos 3 caracteres.")
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Informe um valor maior que zero.")
  }

  if (!formState.categoryId) {
    throw new Error("Selecione uma categoria antes de salvar.")
  }

  if (!formState.occurredOn) {
    throw new Error("Informe a data do lancamento.")
  }

  const recurrenceGroupId = repeatMonths > 1 ? crypto.randomUUID() : null

  return Array.from({ length: repeatMonths }, (_, index) => ({
    amount,
    categoryId: formState.categoryId,
    description,
    occurredOn: addMonthsToOccurredOn(formState.occurredOn, index),
    recurrenceGroupId,
    transactionType: formState.transactionType,
    workspaceId,
  }))
}

function normalizeFormState(
  formState: TransactionFormState,
  month: string,
  filteredCategories: FinanceCategory[]
): TransactionFormState {
  const nextOccurredOn = formState.occurredOn.startsWith(month)
    ? formState.occurredOn
    : getDefaultOccurredOn(month)
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

export default DashboardPage