import {
  createContext, useContext, useState,
  useCallback, useEffect, type ReactNode
} from "react";
import {
  collection, addDoc, getDocs, setDoc, deleteDoc,
  updateDoc, doc, getDoc
} from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import { db, auth } from "./firebase";

// ─── Flag de migración a nivel módulo ────────────────────────────────────────
// Evita que onAuthStateChanged desloguee al usuario mientras la migración
// está creando su documento en Firestore.
let _migrationActive = false;

export type UserRole = "admin" | "user";

export interface AppUser {
  username: string;
  role: UserRole;
}

export interface StoredUser {
  id?: string;
  username: string;
  role: UserRole;
  email?: string;
  password?: string;
  paused?: boolean;
}

interface AccessLogEntry {
  username: string;
  role: UserRole;
  loginAt: string;
}

interface AuthContextValue {
  user: AppUser | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  accessLog: AccessLogEntry[];
  users: StoredUser[];
  addUser: (u: Omit<StoredUser, "id" | "email"> & { password?: string }) => Promise<void>;
  removeUser: (id: string) => Promise<void>;
  updateUser: (id: string, updates: Partial<StoredUser>) => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => {
    try {
      const raw = sessionStorage.getItem("fogop_session");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const [users, setUsers] = useState<StoredUser[]>([]);
  const [accessLog, setAccessLog] = useState<AccessLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Listener de sesión de Firebase Auth ───────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Si hay una migración en curso, el documento en Firestore todavía no
        // existe. No hacemos nada: login() se encargará de setUser() una vez
        // que termine de guardar el perfil.
        if (_migrationActive) {
          setLoading(false);
          return;
        }

        try {
          const userDoc = await getDoc(doc(db, "usuarios", firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.paused) {
              await signOut(auth);
              setUser(null);
              sessionStorage.removeItem("fogop_session");
              setLoading(false);
              return;
            }
            const appUser: AppUser = { username: data.username, role: data.role };
            setUser(appUser);
            sessionStorage.setItem("fogop_session", JSON.stringify(appUser));
          } else {
            // No encontramos perfil: cerramos sesión de Auth por seguridad.
            await signOut(auth);
            setUser(null);
            sessionStorage.removeItem("fogop_session");
          }
        } catch (e) {
          console.error("Error al recuperar sesión activa:", e);
        }
      } else {
        setUser(null);
        sessionStorage.removeItem("fogop_session");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ─── Cargar datos de administración ────────────────────────────────────────
  useEffect(() => {
    if (!user || user.role !== "admin") {
      setUsers([]);
      setAccessLog([]);
      return;
    }

    async function cargarDatosAdmin() {
      try {
        const snapUsuarios = await getDocs(collection(db, "usuarios"));
        const lista: StoredUser[] = snapUsuarios.docs.map(d => ({
          id: d.id,
          ...(d.data() as Omit<StoredUser, "id">)
        }));
        setUsers(lista);

        const snapLog = await getDocs(collection(db, "accessLog"));
        const log: AccessLogEntry[] = snapLog.docs
          .map(d => d.data() as AccessLogEntry)
          .sort((a, b) => new Date(b.loginAt).getTime() - new Date(a.loginAt).getTime());
        setAccessLog(log);
      } catch (e) {
        console.error("Error cargando paneles de administración:", e);
      }
    }

    cargarDatosAdmin();
  }, [user]);

  // ─── LOGIN con migración automática ────────────────────────────────────────
  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    const cleanUsername = username.trim();
    const email = `${cleanUsername.toLowerCase()}@fogop.local`;

    // authUID: se llena si Firebase Auth ya tiene una cuenta para este email/password
    let authUID: string | null = null;

    // ── PASO 1: Intentar login directo con Firebase Auth (usuario ya migrado) ──
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      authUID = userCredential.user.uid;

      const userDoc = await getDoc(doc(db, "usuarios", authUID));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.paused) {
          await signOut(auth);
          throw new Error("USER_PAUSED");
        }
        // ✅ Caso ideal: Firebase Auth + Firestore doc vinculados correctamente
        const appUser: AppUser = { username: data.username, role: data.role };
        setUser(appUser);
        sessionStorage.setItem("fogop_session", JSON.stringify(appUser));
        await addDoc(collection(db, "accessLog"), {
          username: data.username,
          role: data.role,
          loginAt: new Date().toISOString()
        });
        return true;
      }
      // Firebase Auth OK pero no hay doc de Firestore con ese UID.
      // Puede ser un doc legacy con ID distinto → caemos al paso 2.
    } catch {
      // No tiene cuenta en Firebase Auth → seguimos con migración
    }

    // ── PASO 2: Buscar doc legacy en Firestore (tiene campo password) ──────────
    try {
      const snapUsuarios = await getDocs(collection(db, "usuarios"));
      const docAntiguo = snapUsuarios.docs.find(d => {
        const data = d.data();
        return (
          data.username &&
          data.username.toLowerCase() === cleanUsername.toLowerCase() &&
          data.password === password
        );
      });

      if (!docAntiguo) {
        // No hay doc legacy con password. Si estaba autenticado en Auth pero sin
        // doc Firestore, es una cuenta huérfana: cerramos sesión.
        if (authUID) await signOut(auth);
        return false;
      }

      const oldData = docAntiguo.data();
      if (oldData.paused) {
        if (authUID) await signOut(auth);
        throw new Error("USER_PAUSED");
      }

      // ── PASO 3: Conseguir el UID de Firebase Auth ──────────────────────────
      // Activamos el flag ANTES de cualquier operación de Auth para que
      // onAuthStateChanged no desloguee al usuario durante la migración.
      _migrationActive = true;

      let uid: string;

      if (authUID) {
        // ✅ Ya tenemos el UID de Firebase Auth (paso 1 firmó con éxito).
        // No necesitamos crear otra cuenta → usamos ese UID directamente.
        uid = authUID;
      } else {
        // Intentamos crear la cuenta en Firebase Auth
        try {
          const credential = await createUserWithEmailAndPassword(auth, email, password);
          uid = credential.user.uid;
        } catch (authErr: any) {
          if (authErr?.code === "auth/email-already-in-use") {
            // La cuenta Auth ya existe pero no firmamos en el paso 1 (raro).
            // Intentamos firmar ahora.
            try {
              const cred = await signInWithEmailAndPassword(auth, email, password);
              uid = cred.user.uid;
            } catch {
              _migrationActive = false;
              return false;
            }
          } else if (authErr?.code === "auth/weak-password") {
            // Contraseña < 6 caracteres: Firebase Auth la rechaza.
            // Logueamos directamente desde Firestore sin migrar.
            _migrationActive = false;
            const appUser: AppUser = { username: oldData.username, role: oldData.role };
            setUser(appUser);
            sessionStorage.setItem("fogop_session", JSON.stringify(appUser));
            await addDoc(collection(db, "accessLog"), {
              username: oldData.username,
              role: oldData.role,
              loginAt: new Date().toISOString()
            });
            return true;
          } else {
            _migrationActive = false;
            throw authErr;
          }
        }
      }

      // ── PASO 4: Guardar (o reemplazar) el perfil en Firestore con el UID Auth ─
      await setDoc(doc(db, "usuarios", uid), {
        username: oldData.username,
        role: oldData.role,
        email: email,
        password: oldData.password ?? password, // conservar para visibilidad del admin
        paused: oldData.paused ?? false,
      });

      // ── PASO 5: Eliminar el doc legacy con ID aleatorio ─────────────────────
      if (docAntiguo.id !== uid) {
        await deleteDoc(doc(db, "usuarios", docAntiguo.id));
      }

      _migrationActive = false;

      // ── PASO 6: Establecer la sesión ────────────────────────────────────────
      const appUser: AppUser = { username: oldData.username, role: oldData.role };
      setUser(appUser);
      sessionStorage.setItem("fogop_session", JSON.stringify(appUser));

      await addDoc(collection(db, "accessLog"), {
        username: oldData.username,
        role: oldData.role,
        loginAt: new Date().toISOString()
      });

      return true;

    } catch (err) {
      _migrationActive = false;
      console.error("Error durante la migración de usuario:", err);
      return false;
    }
  }, []);

  // ─── LOGOUT ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try { await signOut(auth); } catch (e) {
      console.error("Error al desloguear:", e);
    }
    setUser(null);
    sessionStorage.removeItem("fogop_session");
  }, []);

  // ─── AGREGAR USUARIO ───────────────────────────────────────────────────────
  // Guarda el usuario directamente en Firestore con addDoc.
  // La próxima vez que inicie sesión, la migración automática crea su cuenta
  // en Firebase Auth de forma transparente.
  const addUser = useCallback(async (u: Omit<StoredUser, "id" | "email"> & { password?: string }) => {
    if (!u.password) throw new Error("La contraseña es obligatoria.");
    try {
      const ref = await addDoc(collection(db, "usuarios"), {
        username: u.username.trim(),
        role: u.role,
        password: u.password,
      });
      setUsers(prev => [
        ...prev,
        { id: ref.id, username: u.username.trim(), role: u.role, password: u.password },
      ]);
    } catch (error) {
      console.error("Error al registrar nuevo usuario:", error);
      throw error;
    }
  }, []);

  // ─── ELIMINAR USUARIO ──────────────────────────────────────────────────────
  const removeUser = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, "usuarios", id));
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (error) {
      console.error("Error al eliminar usuario:", error);
      throw error;
    }
  }, []);

  // ─── ACTUALIZAR USUARIO ────────────────────────────────────────────────────
  const updateUser = useCallback(async (id: string, updates: Partial<StoredUser>) => {
    try {
      await updateDoc(doc(db, "usuarios", id), { ...updates });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    } catch (error) {
      console.error("Error al actualizar usuario:", error);
      throw error;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, accessLog, users, addUser, removeUser, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
