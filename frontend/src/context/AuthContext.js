import { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = logged out
  const [ready, setReady] = useState(false);

  const loadMe = async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
    } catch {
      setUser(false);
    } finally {
      setReady(true);
    }
  };

  useEffect(() => {
    if (localStorage.getItem("clara_token")) loadMe();
    else {
      setUser(false);
      setReady(true);
    }
  }, []);

  const login = (token, u) => {
    localStorage.setItem("clara_token", token);
    setUser(u);
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("clara_token");
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, ready, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
