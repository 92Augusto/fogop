import {
  createContext, useContext, useState,
  useCallback, useEffect, type ReactNode
} from "react";
import {
  collection, doc,
  getDocs, setDoc, deleteDoc,
  updateDoc, addDoc
} from "firebase/firestore";
import { db } from "./firebase";

export type UserRole = "admin" | "user";

export interface AppUser {
  username: string;
  role: UserRole;
}

export interface StoredUser {
  id?: string;
  username: string;
  password: string;
  role: UserRole;
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
  addUser: (u: Omit<StoredUser, "id">) => Promise<void>;
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

  useEffect(() => {
    async function cargarUsuarios() {
      try {
        const snap = await getDocs(collection(db, "usuarios"));
        const lista: StoredUser[] = snap.docs.map(d => ({
          id: d.id,
          ...(d.data() as Omit<StoredUser, "id">)
        }));
        if (lista.length === 0) {
          const ref = await addDoc(collection(db, "usuarios"), {
            username: "Augusto",
            password: "Augusto92",
            role: "admin"
          });
          lista.push({ id: ref.id, username: "Augusto", password: "Augusto92", role: "admin" });
        }
        setUsers(lista);
      } catch (e) {
        console.error("Error cargando usuarios:", e);
      } finally {
        setLoading(false);
      }
    }
    cargarUsuarios();
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    const found = users.find(
      u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
    );
    if (!found) return false;

    const appUser: AppUser = { username: found.username, role: found.role };
    setUser(appUser);
    sessionStorage.setItem("fogop_session", JSON.stringify(appUser));

    try {
      await addDoc(collection(db, "accessLog"), {
        username: found.username,
        role: found.role,
        loginAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("Error guardando log:", e);
    }

    return true;
  }, [users]);

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem("fogop_session");
  }, []);

  const addUser = useCallback(async (u: Omit<StoredUser, "id">) => {
    const ref = await addDoc(collection(db, "usuarios"), u);
    setUsers(prev => [...prev, { id: ref.id, ...u }]);
  }, []);

  const removeUser = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "usuarios", id));
    setUsers(prev => prev.filter(u => u.id !== id));
  }, []);

  const updateUser = useCallback(async (id: string, updates: Partial<StoredUser>) => {
    await updateDoc(doc(db, "usuarios", id), updates);
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
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