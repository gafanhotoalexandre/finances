import { supabase } from "@/lib/supabase"

export type TransactionType = "in" | "out"
export type CategoryScope = TransactionType | "both"
export type PaymentMethod = "credit_card" | "debit" | "pix" | "cash"
export type TransactionMutationScope = "single" | "this-and-future"

export type FinanceCategory = {
  id: string
  isSystem: boolean
  name: string
  scope: CategoryScope
}

export function isReserveSystemCategory(
  category: Pick<FinanceCategory, "isSystem" | "name">
) {
  return category.isSystem && category.name.trim().toLowerCase() === "reserva"
}

export type FinanceTransaction = {
  amount: number
  categoryId: string | null
  createdAt: string
  description: string
  id: string
  notes: string | null
  occurredOn: string
  paymentMethod: PaymentMethod
  recurrenceGroupId: string | null
  transactionType: TransactionType
}

export type DashboardSummary = {
  currentBalance: number
  previousBalance: number
  totalIn: number
  totalOut: number
  transactionCount: number
}

export type DashboardData = {
  categories: FinanceCategory[]
  summary: DashboardSummary
  transactions: FinanceTransaction[]
}

export type FinanceReserve = {
  createdAt: string
  id: string
  name: string
  targetAmount: number | null
  updatedAt: string
}

export type ReserveEntryType = TransactionType

export type FinanceReserveEntry = {
  amount: number
  createdAt: string
  description: string
  entryType: ReserveEntryType
  id: string
  notes: string | null
  occurredOn: string
  reserveId: string
  sourceTransactionId: string | null
  updatedAt: string
}

export type ReserveSummary = FinanceReserve & {
  currentAmount: number
  entryCount: number
  lastEntryOn: string | null
  remainingAmount: number | null
}

export type CreateTransactionInput = {
  amount: number
  categoryId: string
  description: string
  notes?: string | null
  occurredOn: string
  paymentMethod: PaymentMethod
  recurrenceGroupId: string | null
  transactionType: TransactionType
  workspaceId: string
}

export type CreateReserveInput = {
  name: string
  targetAmount: number | null
  workspaceId: string
}

export type UpdateTransactionInput = {
  amount: number
  categoryId: string
  description: string
  occurredOn: string
  paymentMethod: PaymentMethod
  transactionType: TransactionType
}

export type DeleteTransactionInput = {
  scope: TransactionMutationScope
  targetOccurredOn: string
  targetRecurrenceGroupId: string | null
  transactionId: string
}

export type UpdateTransactionArgs = DeleteTransactionInput & {
  values: UpdateTransactionInput
}

export type AllocateToReserveInput = {
  amount: number
  categoryId?: string | null
  description: string
  notes?: string | null
  occurredOn: string
  paymentMethod?: PaymentMethod
  reserveId: string
}

export type AllocateToReserveResult = {
  reserveEntryId: string
  transactionId: string
}

type CategoryRow = {
  id: string
  is_system: boolean
  name: string
  scope: CategoryScope
}

type TransactionRow = {
  amount: number | string
  category_id: string | null
  created_at: string
  description: string
  id: string
  notes: string | null
  occurred_on: string
  payment_method: PaymentMethod
  recurrence_group_id: string | null
  transaction_type: TransactionType
}

type MutationTransactionRow = {
  description: string
  id: string
  occurred_on: string
}

type ReserveSummaryRow = {
  created_at: string
  current_amount: number | string
  entry_count: number | string
  last_entry_on: string | null
  name: string
  remaining_amount: number | string | null
  reserve_id: string
  target_amount: number | string | null
  updated_at: string
}

type AllocateToReserveRow = {
  reserve_entry_id: string
  transaction_id: string
}

const MONTH_PARAM_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
const APP_TIME_ZONE = "America/Sao_Paulo"
const INSTALLMENT_SUFFIX_PATTERN = /\s+\(\d+\/\d+\)$/

const APP_DATE_PARTS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: APP_TIME_ZONE,
  year: "numeric",
})

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  timeZone: "UTC",
  year: "numeric",
})

type CalendarDateParts = {
  day: number
  monthIndex: number
  year: number
}

export function getCurrentMonthParam() {
  const { monthIndex, year } = getCurrentAppDateParts()

  return formatMonthParamParts(year, monthIndex)
}

export function getCurrentAppYear() {
  return getCurrentAppDateParts().year
}

export function getCurrentOccurredOn() {
  const { day, monthIndex, year } = getCurrentAppDateParts()

  return toIsoDate(year, monthIndex, day)
}

export function isMonthParam(value: string | null | undefined): value is string {
  return typeof value === "string" && MONTH_PARAM_PATTERN.test(value)
}

export function formatMonthLabel(month: string) {
  const { monthIndex, year } = parseMonthParam(month)

  return MONTH_LABEL_FORMATTER.format(new Date(Date.UTC(year, monthIndex, 1)))
}

export function addMonthsToMonthParam(month: string, delta: number) {
  const { monthIndex, year } = parseMonthParam(month)

  return formatUtcMonthParam(new Date(Date.UTC(year, monthIndex + delta, 1)))
}

export function addMonthsToOccurredOn(dateString: string, delta: number) {
  const [rawYear, rawMonth, rawDay] = dateString.split("-")
  const year = Number(rawYear)
  const monthIndex = Number(rawMonth) - 1
  const day = Number(rawDay)

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(monthIndex) ||
    !Number.isInteger(day)
  ) {
    throw new Error("INVALID_OCCURRED_ON")
  }

  const shiftedMonthIndex = monthIndex + delta
  const targetYear = year + Math.floor(shiftedMonthIndex / 12)
  const normalizedMonthIndex = ((shiftedMonthIndex % 12) + 12) % 12
  const maxDay = new Date(
    Date.UTC(targetYear, normalizedMonthIndex + 1, 0)
  ).getUTCDate()
  const clampedDay = Math.min(day, maxDay)

  return toIsoDate(targetYear, normalizedMonthIndex, clampedDay)
}

export function formatInstallmentDescription(
  description: string,
  installmentNumber: number,
  installmentTotal: number
) {
  const trimmedDescription = description.trim()
  const baseDescription = stripInstallmentSuffix(trimmedDescription).trim()
  const normalizedDescription =
    baseDescription.length > 0 ? baseDescription : trimmedDescription

  return `${normalizedDescription} (${installmentNumber}/${installmentTotal})`
}

export async function getDashboardData(month: string) {
  const { endDate, startDate } = getMonthBounds(month)

  const [categoriesResult, transactionsResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id, is_system, name, scope")
      .order("is_system", { ascending: false })
      .order("name", { ascending: true }),
    supabase
      .from("transactions")
      .select(
        "id, description, transaction_type, payment_method, amount, occurred_on, notes, recurrence_group_id, category_id, created_at"
      )
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false }),
  ])

  if (categoriesResult.error) {
    throw categoriesResult.error
  }

  if (transactionsResult.error) {
    throw transactionsResult.error
  }

  const categories = ((categoriesResult.data ?? []) as CategoryRow[]).map(
    mapCategoryRow
  )
  const allTransactions = ((transactionsResult.data ?? []) as TransactionRow[]).map(
    mapTransactionRow
  )
  const transactions = filterTransactionsByMonth(
    allTransactions,
    startDate,
    endDate
  )

  return {
    categories,
    summary: summarizeTransactions(allTransactions, startDate, endDate),
    transactions,
  } satisfies DashboardData
}

export async function createTransactions(entries: CreateTransactionInput[]) {
  const { error } = await supabase.from("transactions").insert(
    entries.map((entry) => ({
      amount: entry.amount,
      category_id: entry.categoryId,
      description: entry.description,
      notes: entry.notes ?? null,
      occurred_on: entry.occurredOn,
      payment_method: entry.paymentMethod,
      recurrence_group_id: entry.recurrenceGroupId,
      transaction_type: entry.transactionType,
      workspace_id: entry.workspaceId,
    }))
  )

  if (error) {
    throw error
  }
}

export async function createReserve({
  name,
  targetAmount,
  workspaceId,
}: CreateReserveInput) {
  const normalizedName = name.trim()

  if (normalizedName.length === 0) {
    throw new Error("RESERVE_NAME_REQUIRED")
  }

  if (normalizedName.length < 2 || normalizedName.length > 80) {
    throw new Error("RESERVE_NAME_LENGTH_INVALID")
  }

  if (!workspaceId) {
    throw new Error("WORKSPACE_CONTEXT_REQUIRED")
  }

  if (
    targetAmount !== null &&
    (!Number.isFinite(targetAmount) || Number(targetAmount) <= 0)
  ) {
    throw new Error("INVALID_TARGET_AMOUNT")
  }

  const { error } = await supabase.from("reserves").insert({
    name: normalizedName,
    target_amount: targetAmount,
    workspace_id: workspaceId,
  })

  if (error) {
    if (error.code === "23505") {
      throw new Error("RESERVE_NAME_ALREADY_EXISTS")
    }

    throw error
  }
}

export async function getReservesSummary() {
  const { data, error } = await supabase.rpc("get_reserves_summary")

  if (error) {
    throw error
  }

  return ((data ?? []) as ReserveSummaryRow[]).map(mapReserveSummaryRow)
}

export async function allocateToReserve({
  amount,
  categoryId = null,
  description,
  notes,
  occurredOn,
  paymentMethod = "cash",
  reserveId,
}: AllocateToReserveInput) {
  const normalizedAmount = Number(amount)
  const normalizedDescription = description.trim()
  const normalizedNotes = notes?.trim() || null

  if (!reserveId) {
    throw new Error("RESERVE_ID_REQUIRED")
  }

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error("INVALID_AMOUNT")
  }

  if (normalizedDescription.length < 3) {
    throw new Error("INVALID_DESCRIPTION")
  }

  if (!occurredOn) {
    throw new Error("INVALID_OCCURRED_ON")
  }

  const { data, error } = await supabase.rpc("allocate_to_reserve", {
    p_amount: normalizedAmount,
    p_category_id: categoryId,
    p_description: normalizedDescription,
    p_notes: normalizedNotes,
    p_occurred_on: occurredOn,
    p_payment_method: paymentMethod,
    p_reserve_id: reserveId,
  })

  if (error) {
    throw error
  }

  const row = ((data ?? []) as AllocateToReserveRow[])[0]

  if (!row) {
    throw new Error("RESERVE_ALLOCATION_FAILED")
  }

  return {
    reserveEntryId: row.reserve_entry_id,
    transactionId: row.transaction_id,
  } satisfies AllocateToReserveResult
}

export async function updateTransaction({
  scope,
  targetOccurredOn,
  targetRecurrenceGroupId,
  transactionId,
  values,
}: UpdateTransactionArgs) {
  const targets = await getTransactionsForMutation({
    scope,
    targetOccurredOn,
    targetRecurrenceGroupId,
    transactionId,
  })

  if (targets.length === 0) {
    throw new Error("TRANSACTION_NOT_FOUND")
  }

  await Promise.all(
    targets.map(async (target) => {
      const payload = {
        amount: values.amount,
        category_id: values.categoryId,
        description: mergeInstallmentSuffix(values.description, target.description),
        occurred_on: scope === "single" ? values.occurredOn : target.occurred_on,
        payment_method: values.paymentMethod,
        transaction_type: values.transactionType,
      }

      const { error } = await supabase
        .from("transactions")
        .update(payload)
        .eq("id", target.id)

      if (error) {
        throw error
      }
    })
  )
}

export async function deleteTransaction({
  scope,
  targetOccurredOn,
  targetRecurrenceGroupId,
  transactionId,
}: DeleteTransactionInput) {
  const query =
    scope === "this-and-future" && targetRecurrenceGroupId
      ? supabase
          .from("transactions")
          .delete()
          .eq("recurrence_group_id", targetRecurrenceGroupId)
          .gte("occurred_on", targetOccurredOn)
      : supabase.from("transactions").delete().eq("id", transactionId)

  const { error } = await query

  if (error) {
    throw error
  }
}

function getMonthBounds(month: string) {
  const { monthIndex, year } = parseMonthParam(month)
  const startDate = toIsoDate(year, monthIndex, 1)
  const endDate = toIsoDate(year, monthIndex + 1, 1)

  return { endDate, startDate }
}

function parseMonthParam(month: string) {
  if (!isMonthParam(month)) {
    throw new Error("INVALID_MONTH_PARAM")
  }

  const [rawYear, rawMonth] = month.split("-")

  return {
    monthIndex: Number(rawMonth) - 1,
    year: Number(rawYear),
  }
}

function getCurrentAppDateParts(date = new Date()): CalendarDateParts {
  return extractCalendarDateParts(APP_DATE_PARTS_FORMATTER.formatToParts(date))
}

function extractCalendarDateParts(
  parts: Intl.DateTimeFormatPart[]
): CalendarDateParts {
  const day = getNumberPart(parts, "day")
  const month = getNumberPart(parts, "month")
  const year = getNumberPart(parts, "year")

  return {
    day,
    monthIndex: month - 1,
    year,
  }
}

function getNumberPart(
  parts: Intl.DateTimeFormatPart[],
  type: "day" | "month" | "year"
) {
  const value = parts.find((part) => part.type === type)?.value
  const parsedValue = Number(value)

  if (!Number.isInteger(parsedValue)) {
    throw new Error(`INVALID_DATE_PART_${type.toUpperCase()}`)
  }

  return parsedValue
}

function formatMonthParamParts(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`
}

function formatUtcMonthParam(date: Date) {
  return formatMonthParamParts(date.getUTCFullYear(), date.getUTCMonth())
}

function toIsoDate(year: number, monthIndex: number, day: number) {
  const normalizedDate = new Date(Date.UTC(year, monthIndex, day))

  return normalizedDate.toISOString().slice(0, 10)
}

function mapCategoryRow(row: CategoryRow): FinanceCategory {
  return {
    id: row.id,
    isSystem: row.is_system,
    name: row.name,
    scope: row.scope,
  }
}

function mapTransactionRow(row: TransactionRow): FinanceTransaction {
  return {
    amount: Number(row.amount),
    categoryId: row.category_id,
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    notes: row.notes,
    occurredOn: row.occurred_on,
    paymentMethod: row.payment_method,
    recurrenceGroupId: row.recurrence_group_id,
    transactionType: row.transaction_type,
  }
}

function mapReserveSummaryRow(row: ReserveSummaryRow): ReserveSummary {
  return {
    createdAt: row.created_at,
    currentAmount: Number(row.current_amount),
    entryCount: Number(row.entry_count),
    id: row.reserve_id,
    lastEntryOn: row.last_entry_on,
    name: row.name,
    remainingAmount:
      row.remaining_amount === null ? null : Number(row.remaining_amount),
    targetAmount: row.target_amount === null ? null : Number(row.target_amount),
    updatedAt: row.updated_at,
  }
}

async function getTransactionsForMutation({
  scope,
  targetOccurredOn,
  targetRecurrenceGroupId,
  transactionId,
}: DeleteTransactionInput) {
  if (scope === "this-and-future" && targetRecurrenceGroupId) {
    const { data, error } = await supabase
      .from("transactions")
      .select("id, description, occurred_on")
      .eq("recurrence_group_id", targetRecurrenceGroupId)
      .gte("occurred_on", targetOccurredOn)
      .order("occurred_on", { ascending: true })
      .order("created_at", { ascending: true })

    if (error) {
      throw error
    }

    return (data ?? []) as MutationTransactionRow[]
  }

  const { data, error } = await supabase
    .from("transactions")
    .select("id, description, occurred_on")
    .eq("id", transactionId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? [data as MutationTransactionRow] : []
}

function stripInstallmentSuffix(description: string) {
  return description.replace(INSTALLMENT_SUFFIX_PATTERN, "")
}

function extractInstallmentSuffix(description: string) {
  return description.match(INSTALLMENT_SUFFIX_PATTERN)?.[0]?.trim() ?? null
}

function mergeInstallmentSuffix(nextDescription: string, currentDescription: string) {
  const trimmedNextDescription = nextDescription.trim()
  const currentSuffix = extractInstallmentSuffix(currentDescription)

  if (!currentSuffix) {
    return trimmedNextDescription
  }

  const baseDescription = stripInstallmentSuffix(trimmedNextDescription).trim()

  if (baseDescription.length === 0) {
    return trimmedNextDescription
  }

  return `${baseDescription} ${currentSuffix}`
}

function filterTransactionsByMonth(
  transactions: FinanceTransaction[],
  startDate: string,
  endDate: string
) {
  return transactions.filter(
    (transaction) =>
      transaction.occurredOn >= startDate && transaction.occurredOn < endDate
  )
}

function summarizeTransactions(
  transactions: FinanceTransaction[],
  startDate: string,
  endDate: string
): DashboardSummary {
  let previousBalance = 0
  let totalIn = 0
  let totalOut = 0
  let transactionCount = 0

  for (const transaction of transactions) {
    const signedAmount =
      transaction.transactionType === "in"
        ? transaction.amount
        : -transaction.amount

    if (transaction.occurredOn < startDate) {
      previousBalance += signedAmount
      continue
    }

    if (transaction.occurredOn >= endDate) {
      continue
    }

    transactionCount += 1

    if (transaction.transactionType === "in") {
      totalIn += transaction.amount
      continue
    }

    totalOut += transaction.amount
  }

  const currentBalance = previousBalance + totalIn - totalOut

  return {
    currentBalance,
    previousBalance,
    totalIn,
    totalOut,
    transactionCount,
  }
}