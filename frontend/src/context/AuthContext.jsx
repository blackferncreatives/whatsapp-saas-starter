import { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('authToken'));
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('authUser');
    return stored ? JSON.parse(stored) : null;
  });

  const persist = useCallback((nextToken, nextUser) => {
    localStorage.setItem('authToken', nextToken);
    localStorage.setItem('authUser', JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const login = useCallback(
    async (email, password) => {
      const data = await api.login({ email, password });
      persist(data.token, data.user);
    },
    [persist]
  );

  const signup = useCallback(
    async (tenantName, email, password) => {
      const data = await api.signup({ tenantName, email, password });
      persist(data.token, data.user);
    },
    [persist]
  );

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
