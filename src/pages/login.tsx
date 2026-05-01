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
import type { LoginActionData, LoginLoaderData } from "@/routes/data"

export function LoginPage() {
  const loaderData = useLoaderData() as LoginLoaderData
  const actionData = useActionData() as LoginActionData | undefined
  const navigation = useNavigation()

  const isSubmitting = navigation.state === "submitting"
  const notice = actionData?.info ?? loaderData.info

  return (
    <Card className="glass-card rounded-[28px] border-white/55 bg-white/84 py-0 shadow-[0_24px_64px_-32px_rgba(15,23,42,0.45)] dark:border-slate-700/70 dark:bg-slate-950/60">
      <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
        <CardAction>
          <Badge
            variant="outline"
            className="border-slate-200/90 bg-slate-50/85 text-slate-700 dark:border-slate-700/70 dark:bg-slate-950/55 dark:text-slate-200"
          >
            Login
          </Badge>
        </CardAction>
        <CardTitle className="text-lg text-slate-800 sm:text-xl dark:text-slate-100">
          Entrar
        </CardTitle>
        <CardDescription className="text-slate-600 dark:text-slate-300">
          Use seu e-mail e sua senha para voltar ao seu espaço com rapidez.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 px-5 pb-5 sm:gap-6 sm:px-6 sm:pb-6">
        {notice ? (
          <p className="rounded-2xl border border-sky-200/80 bg-sky-50/70 px-4 py-3 text-sm text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200">
            {notice}
          </p>
        ) : null}

        <Form method="post" className="flex flex-col gap-6">
          <FieldSet>
            <FieldLegend>Seus dados</FieldLegend>
            <FieldDescription>
              Se sua conta ainda não estiver ligada a um espaço, tudo bem.
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
            className="auth-cta auth-login-cta w-full"
            disabled={!loaderData.configured || isSubmitting}
          >
            {isSubmitting ? "Entrando..." : "Entrar"}
          </Button>
        </Form>

        <div className="rounded-[22px] border border-slate-200/80 bg-white/72 px-4 py-4 text-sm text-slate-500 dark:border-slate-700/70 dark:bg-slate-950/45 dark:text-slate-400">
          <span className="block">Já recebeu um convite?</span>
          <span>
            Abra o link enviado pela pessoa que administra seu espaço. Se
            quiser recomeçar do início, volte para a <Link className="underline underline-offset-4 hover:text-foreground" to="/">página inicial</Link>.
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export default LoginPage