import { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [activeCompany, setActiveCompanyState] = useState(localStorage.getItem("clara_company") || null);

  const setActiveCompany = (id) => {
    localStorage.setItem("clara_company", id);
    setActiveCompanyState(id);
  };

  const loadCompanies = async () => {
    try {
      const { data } = await api.get("/companies");
      setCompanies(data);
      const stored = localStorage.getItem("clara_company");
      if (!stored || !data.find((c) => c.id === stored)) {
        if (data[0]) setActiveCompany(data[0].id);
      }
      return data;
    } catch {
      return [];
    }
  };

  const loadMe = async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      await loadCompanies();
    } catch {
      setUser(false);
    } finally {
      setReady(true);
    }
  };

  const refreshUser = async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      return data.user;
    } catch { return null; }
  };

  useEffect(() => {
    if (localStorage.getItem("clara_token")) loadMe();
    else { setUser(false); setReady(true); }
  }, []);

  const login = async (token, u) => {
    localStorage.setItem("clara_token", token);
    setUser(u);
    await loadCompanies();
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("clara_token");
    localStorage.removeItem("clara_company");
    setUser(false);
    setCompanies([]);
  };

  return (
    <AuthContext.Provider value={{
      user, ready, login, logout, setUser, refreshUser,
      companies, activeCompany, setActiveCompany, loadCompanies,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
