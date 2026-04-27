import { isRouteErrorResponse, Link, useRouteError } from "react-router"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function getRouteErrorMessage(error: unknown) {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText}`
  }

  if (error instanceof Error) {
    return error.message
  }

  return "Erro inesperado durante a navegacao."
}

export function RouteErrorPage() {
  const error = useRouteError()

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/20 px-6 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Falha de roteamento</CardTitle>
          <CardDescription>
            O React Router interceptou um erro antes de concluir a navegacao.
          </CardDescription>
        </CardHeader>
        <CardContent className="rounded-lg border border-border/70 bg-muted/30 px-4 py-3 font-mono text-xs text-muted-foreground">
          {getRouteErrorMessage(error)}
        </CardContent>
        <CardFooter>
          <Button asChild>
            <Link to="/login">Voltar para login</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default RouteErrorPage