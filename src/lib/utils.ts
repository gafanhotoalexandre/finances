import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

const BRL_INPUT_FORMATTER = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

function getCurrencyDigits(rawValue: string) {
  return rawValue.replace(/\D/g, "")
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrencyInput(rawValue: number | string) {
  if (typeof rawValue === "number") {
    if (!Number.isFinite(rawValue) || rawValue <= 0) {
      return ""
    }

    return BRL_INPUT_FORMATTER.format(rawValue)
  }

  const digits = getCurrencyDigits(rawValue)

  if (digits.length === 0) {
    return ""
  }

  return BRL_INPUT_FORMATTER.format(Number(digits) / 100)
}

export function parseCurrencyInput(rawValue: string) {
  const digits = getCurrencyDigits(rawValue)

  if (digits.length === 0) {
    return 0
  }

  return Number(digits) / 100
}

export function hasCurrencyInputValue(rawValue: string) {
  return getCurrencyDigits(rawValue).length > 0
}
