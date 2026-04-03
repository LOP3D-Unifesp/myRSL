import { createContext, useContext, type ReactNode } from "react";

const AuthUserIdContext = createContext<string | null>(null);

export function AuthUserIdProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  return <AuthUserIdContext.Provider value={userId}>{children}</AuthUserIdContext.Provider>;
}

export function useAuthUserId(): string | null {
  return useContext(AuthUserIdContext);
}
