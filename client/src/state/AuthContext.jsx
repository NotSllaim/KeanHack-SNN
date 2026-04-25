import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, setToken } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function signup(values) {
    const data = await api("/auth/signup", {
      method: "POST",
      body: JSON.stringify(values)
    });
    setToken(data.token);
    setUser(data.user);
  }

  async function login(values) {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify(values)
    });
    setToken(data.token);
    setUser(data.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, loading, signup, login, logout }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

