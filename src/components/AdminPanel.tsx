import { useState } from "react";
import { useAuth, type StoredUser, type UserRole } from "@/lib/auth";
import { obrasData } from "@/data/obras-data";
import type { Obra, TipoObra, EstadoObra } from "@/data/obras";
import { TIPOS_OBRA, ESTADOS_OBRA, ANIOS } from "@/data/obras";
import { exportAccessLogToPdf } from "@/lib/pdf-export";
import { PasswordPromptDialog } from "@/components/PasswordPromptDialog";

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
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const handleAdd = async () => {
    setError("");
    if (!newUsername.trim() || !newPassword.trim()) {
      setError("Complete todos los campos");
      return;
    }
    if (users.some((u) => u.username.toLowerCase() === newUsername.trim().toLowerCase())) {
      setError("El usuario ya existe");
      return;
    }
    setSaving(true);
    try {
      await addUser({ username: newUsername.trim(), password: newPassword, role: newRole });
      setNewUsername("");
      setNewPassword("");
      setNewRole("user");
    } catch (err: any) {
      // Traducir errores comunes de Firebase a mensajes amigables
      const code = err?.code ?? "";
      if (code === "auth/email-already-in-use") {
        setError("Ese nombre de usuario ya está registrado en el sistema.");
      } else if (code === "auth/weak-password") {
        setError("La contraseña debe tener al menos 6 caracteres.");
      } else {
        setError("Error al crear el usuario. Intentá de nuevo.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEditPassword = (u: StoredUser) => {
    setEditingId(u.id!);
    setEditPassword(u.password ?? "");
  };

  const handleSavePassword = (id: string) => {
    if (!editPassword.trim()) return;
    updateUser(id, { password: editPassword.trim() });
    setEditingId(null);
    setEditPassword("");
  };

  const toggleShowPassword = (id: string) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-foreground">Usuarios registrados</h3>
      <table className="mb-4 w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-2 py-1 font-medium text-foreground">Usuario</th>
            <th className="px-2 py-1 font-medium text-foreground">Contraseña</th>
            <th className="px-2 py-1 font-medium text-foreground">Rol</th>
            <th className="px-2 py-1 font-medium text-foreground">Estado</th>
            <th className="px-2 py-1 font-medium text-foreground">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b">
              <td className="px-2 py-1.5 text-foreground">{u.username}</td>
              <td className="px-2 py-1.5 text-foreground">
                {editingId === u.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      className="rounded-md border bg-background px-2 py-1 text-sm text-foreground w-32"
                    />
                    <button
                      onClick={() => handleSavePassword(u.id!)}
                      className="text-xs text-primary hover:underline"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="font-mono">
                      {showPasswords[u.id!] ? u.password : "••••••••"}
                    </span>
                    <button
                      onClick={() => toggleShowPassword(u.id!)}
                      className="text-xs text-muted-foreground hover:underline ml-1"
                    >
                      {showPasswords[u.id!] ? "Ocultar" : "Ver"}
                    </button>
                    <button
                      onClick={() => handleEditPassword(u)}
                      className="text-xs text-primary hover:underline ml-1"
                    >
                      Editar
                    </button>
                  </div>
                )}
              </td>
              <td className="px-2 py-1.5 text-foreground capitalize">
                {u.role === "admin" ? "Administrador" : "Usuario"}
              </td>
              <td className="px-2 py-1.5 text-foreground">
                {u.paused ? (
                  <span className="text-xs font-semibold text-destructive">Pausado</span>
                ) : (
                  <span className="text-xs font-semibold text-emerald-500">Activo</span>
                )}
              </td>
              <td className="px-2 py-1.5 flex items-center gap-3">
                {u.username !== currentUser?.username ? (
                  <>
                    <button
                      onClick={() => updateUser(u.id!, { paused: !u.paused })}
                      className={`text-xs hover:underline ${u.paused ? 'text-emerald-500' : 'text-amber-500'}`}
                    >
                      {u.paused ? 'Despausar' : 'Pausar'}
                    </button>
                    <button
                      onClick={() => removeUser(u.id!)}
                      className="text-xs text-destructive hover:underline"
                    >
                      Eliminar
                    </button>
                  </>
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
            type="text"
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
          disabled={saving}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-accent disabled:opacity-50"
        >
          {saving ? "Creando..." : "Agregar"}
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
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Registro de accesos ({accessLog.length})
        </h3>
        <button
          onClick={() => setIsPasswordModalOpen(true)}
          disabled={accessLog.length === 0}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-accent disabled:opacity-40"
        >
          Exportar PDF
        </button>
        <PasswordPromptDialog
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          onConfirm={() => exportAccessLogToPdf(accessLog)}
        />
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
