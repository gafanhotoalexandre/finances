export type SessionHandoffIntent = "login" | "invite" | "logout"

const DEFAULT_SESSION_HANDOFF_TARGET = "/login"

export function buildSessionHandoffPath(
  intent: SessionHandoffIntent,
  target: string
) {
  const searchParams = new URLSearchParams({
    intent,
    to: normalizeSessionHandoffTarget(target),
  })

  return `/handoff?${searchParams.toString()}`
}

export function normalizeSessionHandoffTarget(value: string | null | undefined) {
  if (!value || !value.startsWith("/")) {
    return DEFAULT_SESSION_HANDOFF_TARGET
  }

  return value
}

export function parseSessionHandoffIntent(
  value: string | null | undefined
): SessionHandoffIntent {
  if (value === "invite" || value === "logout") {
    return value
  }

  return "login"
}