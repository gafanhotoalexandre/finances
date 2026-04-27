import { supabase } from "@/lib/supabase"

export type TransactionType = "in" | "out"
export type CategoryScope = TransactionType | "both"

export type FinanceCategory = {
  id: string
  isSystem: boolean
  name: string
  scope: CategoryScope
}

export type FinanceTransaction = {
  amount: number
  categoryId: string | null
  createdAt: string
  description: string
  id: string
  notes: string | null
  occurredOn: string
  recurrenceGroupId: string | null
  transactionType: TransactionType
}

export type DashboardSummary = {
  balance: number
  totalIn: number
  totalOut: number
  transactionCount: number
}

export type DashboardData = {
  categories: FinanceCategory[]
  summary: DashboardSummary
  transactions: FinanceTransaction[]
}

export type CreateTransactionInput = {
  amount: number
  categoryId: string
  description: string
  notes?: string | null
  occurredOn: string
  recurrenceGroupId: string | null
  transactionType: TransactionType
  workspaceId: string
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
  recurrence_group_id: string | null
  transaction_type: TransactionType
}

const MONTH_PARAM_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
const APP_TIME_ZONE = "America/Sao_Paulo"

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
        "id, description, transaction_type, amount, occurred_on, notes, recurrence_group_id, category_id, created_at"
      )
      .gte("occurred_on", startDate)
      .lt("occurred_on", endDate)
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
  const transactions = ((transactionsResult.data ?? []) as TransactionRow[]).map(
    mapTransactionRow
  )

  return {
    categories,
    summary: summarizeTransactions(transactions),
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
      recurrence_group_id: entry.recurrenceGroupId,
      transaction_type: entry.transactionType,
      workspace_id: entry.workspaceId,
    }))
  )

  if (error) {
    throw error
  }
}

export async function deleteTransaction(transactionId: string) {
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId)

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
    recurrenceGroupId: row.recurrence_group_id,
    transactionType: row.transaction_type,
  }
}

function summarizeTransactions(transactions: FinanceTransaction[]): DashboardSummary {
  const totalIn = transactions.reduce((sum, transaction) => {
    if (transaction.transactionType !== "in") {
      return sum
    }

    return sum + transaction.amount
  }, 0)
  const totalOut = transactions.reduce((sum, transaction) => {
    if (transaction.transactionType !== "out") {
      return sum
    }

    return sum + transaction.amount
  }, 0)

  return {
    balance: totalIn - totalOut,
    totalIn,
    totalOut,
    transactionCount: transactions.length,
  }
}