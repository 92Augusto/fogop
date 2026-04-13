import { useState } from "react";
import { useAuth, type StoredUser, type UserRole } from "@/lib/auth";
import { obrasData } from "@/data/obras-data";
import type { Obra, TipoObra, EstadoObra } from "@/data/obras";
import { TIPOS_OBRA, ESTADOS_OBRA, ANIOS } from "@/data/obras";
import { exportAccessLogToExcel } from "@/lib/excel-export";

type Tab = "usuarios" | "obras" | "accesos";

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("usuarios");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-foreground/50 p-4 pt-16">
      <div className="w-full max-w-4xl rounded-lg border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-bold text-foreground">Panel de Administración</h2>
          <button onClick={onClose} className="rounded-md px-3 py-1 text-sm text-muted-foreground hover:bg-muted">
            ✕ Cerrar
          </button>
        </div>
        <div className="flex border-b">
          {(["usuarios", "obras", "accesos"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                tab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="max-h-[70vh] overflow-auto p-4">
          {tab === "usuarios" && <UsersTab />}
          {tab === "obras" && <ObrasTab />}
          {tab === "accesos" && <AccessLogTab />}
        </div>
      </div>
    </div>
  );
}

function UsersTab() {
  const { users, addUser, removeUser, updateUser, user: currentUser } = useAuth();
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("user");
  const [error, setError] = useState("");

  const handleAdd = () => {
    setError("");
    if (!newUsername.trim() || !newPassword.trim()) {
      setError("Complete todos los campos");
      return;
    }
    if (users.some((u) => u.username.toLowerCase() === newUsername.trim().toLowerCase())) {
      setError("El usuario ya existe");
      return;
    }
    addUser({ username: newUsername.trim(), password: newPassword, role: newRole });
    setNewUsername("");
    setNewPassword("");
    setNewRole("user");
  };

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-foreground">Usuarios registrados</h3>
      <table className="mb-4 w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-2 py-1 font-medium text-foreground">Usuario</th>
            <th className="px-2 py-1 font-medium text-foreground">Rol</th>
            <th className="px-2 py-1 font-medium text-foreground">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.username} className="border-b">
              <td className="px-2 py-1.5 text-foreground">{u.username}</td>
              <td className="px-2 py-1.5 text-foreground capitalize">{u.role === "admin" ? "Administrador" : "Usuario"}</td>
              <td className="px-2 py-1.5">
                {u.username !== currentUser?.username ? (
                  <button
                    onClick={() => removeUser(u.username)}
                    className="text-xs text-destructive hover:underline"
                  >
                    Eliminar
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">Actual</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="mb-2 text-sm font-semibold text-foreground">Agregar usuario</h3>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Usuario</label>
          <input
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            className="rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Contraseña</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Rol</label>
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as UserRole)}
            className="rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
          >
            <option value="user">Usuario</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <button
          onClick={handleAdd}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-accent"
        >
          Agregar
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}

function ObrasTab() {
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        La edición de obras estará disponible próximamente. Actualmente los datos se gestionan desde el archivo de datos importado.
      </p>
      <p className="mt-2 text-sm text-foreground">
        Total de obras en el sistema: <strong>{obrasData.length}</strong>
      </p>
    </div>
  );
}

function AccessLogTab() {
  const { accessLog } = useAuth();

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Registro de accesos ({accessLog.length})
        </h3>
        <button
          onClick={() => exportAccessLogToExcel(accessLog)}
          disabled={accessLog.length === 0}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-accent disabled:opacity-40"
        >
          Exportar Excel
        </button>
      </div>
      {accessLog.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin registros de acceso aún.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-2 py-1 font-medium text-foreground">Usuario</th>
              <th className="px-2 py-1 font-medium text-foreground">Rol</th>
              <th className="px-2 py-1 font-medium text-foreground">Fecha y Hora</th>
            </tr>
          </thead>
          <tbody>
            {accessLog.map((e, i) => (
              <tr key={i} className="border-b">
                <td className="px-2 py-1.5 text-foreground">{e.username}</td>
                <td className="px-2 py-1.5 text-foreground">{e.role === "admin" ? "Admin" : "Usuario"}</td>
                <td className="px-2 py-1.5 text-foreground">{new Date(e.loginAt).toLocaleString("es-AR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
