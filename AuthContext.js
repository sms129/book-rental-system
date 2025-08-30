import React, { createContext, useEffect, useState } from 'react';

export const AuthContext = createContext(null);

export default function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(null); // {name, email, role, address, phone}
  const [token, setToken] = useState(null);

  useEffect(() => {
    const t = localStorage.getItem('token');
    const u = localStorage.getItem('user');
    if (t && u) {
      setToken(t);
      setAuthUser(JSON.parse(u));
    }
  }, []);

  const login = (payload) => {
    const { token: t, user } = payload;
    localStorage.setItem('token', t);
    localStorage.setItem('user', JSON.stringify(user));
    setToken(t);
    setAuthUser(user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setAuthUser(null);
  };

  return (
    <AuthContext.Provider value={{ authUser, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
