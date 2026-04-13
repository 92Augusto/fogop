import { useAuth } from "@/lib/auth";
import fogopLogo from "@/assets/fogop-logo.png";

interface Props {
  onOpenAdmin?: () => void;
}

export function Header({ onOpenAdmin }: Props) {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-primary shadow-md">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <img src={fogopLogo} alt="FOGOP" width={48} height={48} className="h-12 w-12 rounded-md bg-primary-foreground p-1" />
        <div className="flex-1">
          <h1 className="text-lg font-bold text-primary-foreground md:text-xl">
            Sistema de Gestión de Obras Públicas
          </h1>
          <p className="text-xs text-primary-foreground/70">
            Municipalidad de Corrientes · FOGOP
          </p>
        </div>
        {user && (
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-primary-foreground/80 sm:inline">
              {user.username} ({user.role === "admin" ? "Admin" : "Usuario"})
            </span>
            {user.role === "admin" && onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                className="rounded-md bg-primary-foreground/20 px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-foreground/30"
              >
                Administrar
              </button>
            )}
            <button
              onClick={logout}
              className="rounded-md bg-primary-foreground/20 px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-foreground/30"
            >
              Salir
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
