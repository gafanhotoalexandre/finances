import { Form, useActionData, useLoaderData, useNavigation } from "react-router"

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
import type { LoginActionData, LoginLoaderData } from "@/routes/data"

export function LoginPage() {
  const loaderData = useLoaderData() as LoginLoaderData
  const actionData = useActionData() as LoginActionData | undefined
  const navigation = useNavigation()

  const isSubmitting = navigation.state === "submitting"
  const notice = actionData?.info ?? loaderData.info

  return (
    <Card className="glass-card mx-auto w-full rounded-[30px] border-white/60 bg-white/88 py-0 shadow-[0_28px_72px_-36px_rgba(15,23,42,0.46)] dark:border-slate-700/70 dark:bg-slate-950/62">
      <CardHeader className="gap-2 px-5 pt-6 sm:px-6 sm:pt-6">
        <CardAction>
          <Badge
            variant="outline"
            className="border-slate-200/90 bg-slate-50/85 text-slate-700 dark:border-slate-700/70 dark:bg-slate-950/55 dark:text-slate-200"
          >
            Login
          </Badge>
        </CardAction>
        <CardTitle className="text-xl text-slate-800 sm:text-[1.35rem] dark:text-slate-100">
          Entrar
        </CardTitle>
        <CardDescription className="max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-300">
          Use seu e-mail e sua senha para voltar ao seu workspace com rapidez.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 px-5 pb-6 sm:gap-7 sm:px-6 sm:pb-6">
        {notice ? (
          <p className="rounded-2xl border border-sky-200/80 bg-sky-50/70 px-4 py-3 text-sm text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200">
            {notice}
          </p>
        ) : null}

        <Form method="post" className="flex flex-col gap-6 sm:gap-7">
          <FieldSet className="gap-5">
            <FieldLegend>Seus dados</FieldLegend>
            <FieldDescription>
              Se sua conta ainda não estiver ligada a um workspace, tudo bem.
              Depois do login, basta abrir um convite para concluir a entrada.
            </FieldDescription>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">E-mail</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  className="h-11 rounded-2xl"
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
                  autoComplete="current-password"
                  className="h-11 rounded-2xl"
                  placeholder="Sua senha"
                  required
                />
              </Field>
            </FieldGroup>
          </FieldSet>

          {actionData?.error ? <FieldError>{actionData.error}</FieldError> : null}

          <Button
            type="submit"
            size="lg"
            className="auth-cta auth-login-cta h-12 w-full rounded-2xl text-base"
            disabled={!loaderData.configured || isSubmitting}
          >
            {isSubmitting ? "Entrando..." : "Entrar"}
          </Button>
        </Form>
      </CardContent>
    </Card>
  )
}

export default LoginPage