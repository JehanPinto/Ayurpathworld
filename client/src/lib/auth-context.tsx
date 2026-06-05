import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User } from "@shared/schema";
import { apiRequest } from "./queryClient";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (user: User, token?: string) => void;
  logout: () => void;
  updateUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function validateSession() {
      try {
        const token = localStorage.getItem("token");
        const headers: HeadersInit = { };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch("/api/auth/me", { credentials: "include", headers });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch (error) {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    validateSession();
  }, []);

  const login = (userData: User, _token?: string) => {
    if (_token) {
      localStorage.setItem("token", _token);
    }
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch(e) {
      console.error("Logout failed", e);
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    window.location.href = "/login";
  };

  const updateUser = async (): Promise<void> => {
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/auth/me", {
        credentials: "include",
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        const fresh: User = data.user;
        localStorage.setItem("user", JSON.stringify(fresh));
        setUser(fresh);
      }
    } catch {
      // silent — keep existing state if re-fetch fails
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}