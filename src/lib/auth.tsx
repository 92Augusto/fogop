import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type UserRole = "admin" | "user";

export interface AppUser {
  username: string;
  role: UserRole;
}

interface AccessLogEntry {
  username: string;
  role: UserRole;
  loginAt: string; // ISO string
}

interface AuthContextValue {
  user: AppUser | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  accessLog: AccessLogEntry[];
  // Admin user management
  users: StoredUser[];
  addUser: (u: StoredUser) => void;
  removeUser: (username: string) => void;
  updateUser: (username: string, updates: Partial<StoredUser>) => void;
}

export interface StoredUser {
  username: string;
  password: string;
  role: UserRole;
}

const DEFAULT_USERS: StoredUser[] = [
  { username: "Augusto", password: "Augusto92", role: "admin" },
];

function loadUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem("fogop_users");
    if (raw) return JSON.parse(raw);
  } catch {}
  return [...DEFAULT_USERS];
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem("fogop_users", JSON.stringify(users));
}

function loadAccessLog(): AccessLogEntry[] {
  try {
    const raw = localStorage.getItem("fogop_access_log");
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveAccessLog(log: AccessLogEntry[]) {
  localStorage.setItem("fogop_access_log", JSON.stringify(log));
}

function loadSession(): AppUser | null {
  try {
    const raw = sessionStorage.getItem("fogop_session");
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => loadSession());
  const [users, setUsers] = useState<StoredUser[]>(() => loadUsers());
  const [accessLog, setAccessLog] = useState<AccessLogEntry[]>(() => loadAccessLog());

  const login = useCallback(
    (username: string, password: string): boolean => {
      const found = users.find(
        (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password
      );
      if (!found) return false;
      const appUser: AppUser = { username: found.username, role: found.role };
      setUser(appUser);
      sessionStorage.setItem("fogop_session", JSON.stringify(appUser));
      const entry: AccessLogEntry = {
        username: found.username,
        role: found.role,
        loginAt: new Date().toISOString(),
      };
      const newLog = [entry, ...accessLog];
      setAccessLog(newLog);
      saveAccessLog(newLog);
      return true;
    },
    [users, accessLog]
  );

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem("fogop_session");
  }, []);

  const addUser = useCallback(
    (u: StoredUser) => {
      const next = [...users, u];
      setUsers(next);
      saveUsers(next);
    },
    [users]
  );

  const removeUser = useCallback(
    (username: string) => {
      const next = users.filter((u) => u.username !== username);
      setUsers(next);
      saveUsers(next);
    },
    [users]
  );

  const updateUser = useCallback(
    (username: string, updates: Partial<StoredUser>) => {
      const next = users.map((u) => (u.username === username ? { ...u, ...updates } : u));
      setUsers(next);
      saveUsers(next);
    },
    [users]
  );

  return (
    <AuthContext.Provider value={{ user, login, logout, accessLog, users, addUser, removeUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
