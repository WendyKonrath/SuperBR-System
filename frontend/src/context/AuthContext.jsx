import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadUsuario = useCallback(async () => {
    if (!authService.isAuthenticated()) {
      setLoading(false);
      return;
    }

    try {
      const userData = await authService.me();
      setUsuario(userData);
      localStorage.setItem('usuario', JSON.stringify(userData));
    } catch (err) {
      console.error('Erro ao carregar usuário:', err);
      authService.logout();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Vincular o callback de logout da API ao contexto
    api.setLogoutCallback(logout);

    const storedUsuario = localStorage.getItem('usuario');
    if (storedUsuario) {
      try {
        setUsuario(JSON.parse(storedUsuario));
      } catch (e) {
        localStorage.removeItem('usuario');
      }
    }
    loadUsuario();
  }, [loadUsuario]);

  const login = async (loginValue, senha) => {
    setError(null);
    setLoading(true);

    try {
      const response = await authService.login(loginValue, senha);

      if (response.primeiro_acesso) {
        setLoading(false);
        return { primeiroAcesso: true, mensagem: response.mensagem };
      }

      authService.setToken(response.token);
      await loadUsuario();
      setLoading(false);
      return { success: true, perfil: response.perfil };
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  };

  const primeiroAcesso = async (loginValue, novaSenha) => {
    setError(null);
    setLoading(true);

    try {
      const response = await authService.primeiroAcesso(loginValue, novaSenha);
      authService.setToken(response.token);
      await loadUsuario();
      setLoading(false);
      return { success: true };
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  };

  const logout = () => {
    authService.logout();
    setUsuario(null);
    setError(null);
  };

  const value = {
    usuario,
    loading,
    error,
    login,
    primeiroAcesso,
    logout,
    isAuthenticated: !!usuario,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;