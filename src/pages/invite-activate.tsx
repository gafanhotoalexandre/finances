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
          <Badge
            variant="outline"
            className="border-indigo-200/90 bg-indigo-50/85 text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-500/10 dark:text-indigo-200"
          >
            Convite
          </Badge>
        </CardAction>
        <CardTitle className="text-xl text-slate-800 dark:text-slate-100">
          Entrar com convite
        </CardTitle>
        <CardDescription className="text-slate-600 dark:text-slate-300">
          Use este codigo para criar sua conta ou liberar o acesso ao seu
          espaco no mesmo fluxo.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 px-6 pb-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <Badge
            variant="secondary"
            className="bg-indigo-100 text-indigo-700 font-mono tracking-[0.16em] uppercase dark:bg-indigo-500/15 dark:text-indigo-200"
          >
            {loaderData.code}
          </Badge>
          <span>
            {isSignedIn
              ? `Voce entrou como ${loaderData.sessionEmail}. Agora falta apenas confirmar.`
              : "Crie sua conta agora para terminar a entrada sem sair desta tela."}
          </span>
        </div>

        <Form method="post" className="flex flex-col gap-6">
          {isSignedIn ? (
            <FieldSet>
              <FieldLegend>Confirmar entrada</FieldLegend>
              <FieldDescription>
                Ao continuar, este convite conecta sua conta ao espaco certo e
                libera o acesso.
              </FieldDescription>
            </FieldSet>
          ) : (
            <FieldSet>
              <FieldLegend>Criar conta</FieldLegend>
              <FieldDescription>
                Preencha seus dados para criar o acesso e entrar logo em
                seguida.
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

          <Button
            type="submit"
            className="auth-cta auth-invite-cta w-full"
            disabled={!loaderData.configured || isSubmitting}
          >
            {isSubmitting
              ? "Ativando..."
              : isSignedIn
                ? "Confirmar e entrar"
                : "Criar conta e entrar"}
          </Button>
        </Form>

        {!isSignedIn ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ja possui conta? Entre pela <Link className="underline underline-offset-4 hover:text-foreground" to="/login">tela de login</Link> e depois volte a este mesmo convite.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default InviteActivatePage