import React, { createContext, useCallback, useContext, useState } from "react";

export type SessionState = "idle" | "expired";

interface AuthContextType {
  sessionState: SessionState;
  intendedPath: string;
  setSessionExpired: (path: string) => void;
  clearSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [intendedPath, setIntendedPath] = useState("/");

  const setSessionExpired = useCallback((path: string) => {
    // Guard against flipping to expired more than once per session
    setSessionState((current) => {
      if (current === "expired") return current;
      setIntendedPath(path);
      return "expired";
    });
  }, []);

  const clearSessionExpired = useCallback(() => {
    setSessionState("idle");
  }, []);

  return (
    <AuthContext.Provider
      value={{ sessionState, intendedPath, setSessionExpired, clearSessionExpired }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
