import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const getRuntimeEnv = (key: string): string => {
  if (typeof window !== "undefined") {
    return (import.meta.env as any)[key] || "";
  }
  const globalEnv = (globalThis as any).process?.env || (globalThis as any).env || {};
  return globalEnv[key] || (import.meta.env as any)[key] || "";
};

export const firebaseConfig = {
  apiKey: getRuntimeEnv("VITE_FIREBASE_API_KEY"),
  authDomain: getRuntimeEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: getRuntimeEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: getRuntimeEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getRuntimeEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getRuntimeEnv("VITE_FIREBASE_APP_ID"),
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Solo activar persistencia offline en el browser (no en el servidor/Worker)
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === "failed-precondition") {
      console.warn("Offline: múltiples pestañas abiertas, persistencia desactivada.");
    } else if (err.code === "unimplemented") {
      console.warn("Offline: este browser no soporta persistencia offline.");
    }
  });
}
