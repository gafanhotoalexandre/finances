import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
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
import type { InviteActionData, InviteLoaderData } from "@/routes/data"

export function InviteActivatePage() {
  const loaderData = useLoaderData() as InviteLoaderData
  const actionData = useActionData() as InviteActionData | undefined
  const navigation = useNavigation()

  const isSubmitting = navigation.state === "submitting"
  const isSignedIn = Boolean(loaderData.sessionEmail)

  return (
    <Card className="glass-card rounded-[28px] border-white/55 bg-white/84 py-0 shadow-[0_24px_64px_-32px_rgba(15,23,42,0.45)] dark:border-slate-700/70 dark:bg-slate-950/60">
      <CardHeader className="px-6 pt-6">
        <CardAction>
          <Badge variant="outline" className="border-white/60 bg-white/60 dark:border-slate-700/70 dark:bg-slate-950/55">
            Convite
          </Badge>
        </CardAction>
        <CardTitle className="text-xl text-slate-800 dark:text-slate-100">Ativar convite</CardTitle>
        <CardDescription className="text-slate-600 dark:text-slate-300">
          O codigo abaixo chama a RPC <span className="font-mono">claim_invite</span> depois que a sessao fica pronta.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 px-6 pb-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <Badge variant="secondary" className="font-mono tracking-[0.16em] uppercase">
            {loaderData.code}
          </Badge>
          <span>
            {isSignedIn
              ? `Sessao detectada para ${loaderData.sessionEmail}.`
              : "Crie a conta agora para consumir o convite no mesmo fluxo."}
          </span>
        </div>

        <Form method="post" className="flex flex-col gap-6">
          {isSignedIn ? (
            <FieldSet>
              <FieldLegend>Confirmar ativacao</FieldLegend>
              <FieldDescription>
                Sua sessao ja esta autenticada. O botao abaixo consome o convite e hidrata o workspace imediatamente.
              </FieldDescription>
            </FieldSet>
          ) : (
            <FieldSet>
              <FieldLegend>Criar conta e ativar</FieldLegend>
              <FieldDescription>
                O cadastro cria a sessao imediatamente porque o Confirm email ja esta desligado no projeto Supabase do MVP.
              </FieldDescription>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">E-mail</FieldLabel>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="voce@exemplo.com"
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="password">Senha</FieldLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Crie uma senha segura"
                    minLength={8}
                    required
                  />
                </Field>
              </FieldGroup>
            </FieldSet>
          )}

          {actionData?.error ? <FieldError>{actionData.error}</FieldError> : null}
          {actionData?.info ? (
            <p className="rounded-2xl border border-sky-200/80 bg-sky-50/70 px-4 py-3 text-sm text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200">
              {actionData.info}
            </p>
          ) : null}

          <Button type="submit" disabled={!loaderData.configured || isSubmitting}>
            {isSubmitting
              ? "Ativando..."
              : isSignedIn
                ? "Consumir convite"
                : "Criar conta e ativar convite"}
          </Button>
        </Form>

        {!isSignedIn ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ja possui conta? Entre em <Link className="underline underline-offset-4 hover:text-foreground" to="/login">/login</Link> e depois reabra esta mesma rota de convite.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default InviteActivatePage