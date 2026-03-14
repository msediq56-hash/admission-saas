"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { UserRole } from "./permissions";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  tenantId: string;
}

const AuthContext = createContext<AuthUser | null>(null);

export function AuthProvider({
  user,
  children,
}: {
  user: AuthUser;
  children: ReactNode;
}) {
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthUser {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
