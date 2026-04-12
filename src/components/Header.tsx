import fogopLogo from "@/assets/fogop-logo.png";

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-primary shadow-md">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <img src={fogopLogo} alt="FOGOP" width={48} height={48} className="h-12 w-12 rounded-md bg-primary-foreground p-1" />
        <div>
          <h1 className="text-lg font-bold text-primary-foreground md:text-xl">
            Sistema de Gestión de Obras Públicas
          </h1>
          <p className="text-xs text-primary-foreground/70">
            Municipalidad de Corrientes · FOGOP
          </p>
        </div>
      </div>
    </header>
  );
}
