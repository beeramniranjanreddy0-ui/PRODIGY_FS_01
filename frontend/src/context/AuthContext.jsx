import { createContext, useContext, useMemo, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({
    user: null,
    accessToken: null,
    refreshToken: null,
    loading: false,
    error: '',
  });

  const value = useMemo(
    () => ({ auth, setAuth }),
    [auth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
