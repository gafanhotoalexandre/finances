import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/20 px-6 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Rota nao encontrada</CardTitle>
          <CardDescription>
            Este app reconhece login, convite, dashboard e a area administrativa protegida.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Se voce chegou aqui durante o teste, volte para o fluxo principal e valide autenticacao, hidratacao e sign out.
        </CardContent>
        <CardFooter>
          <Button asChild>
            <Link to="/login">Ir para login</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default NotFoundPage