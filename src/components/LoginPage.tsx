import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import fogopLogo from "@/assets/fogop-logo.png";

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("Ingrese usuario y contraseña");
      return;
    }
    const ok = login(username.trim(), password);
    if (!ok) setError("Usuario o contraseña incorrectos");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <img src={fogopLogo} alt="FOGOP" width={64} height={64} className="h-16 w-16 rounded-md bg-primary p-1.5" />
          <h1 className="text-xl font-bold text-foreground">Sistema FOGOP</h1>
          <p className="text-sm text-muted-foreground">Ingrese sus credenciales para continuar</p>
        </div>
        <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-foreground">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Nombre de usuario"
              autoFocus
            />
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-foreground">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Contraseña"
            />
          </div>
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-accent"
          >
            Ingresar
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Municipalidad de Corrientes · FOGOP
        </p>
      </div>
    </div>
  );
}
