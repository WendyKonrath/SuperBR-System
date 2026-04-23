import api from './api';

export const authService = {
  async login(login, senha) {
    const response = await api.post('/auth/login', { login, senha });
    return response;
  },

  async primeiroAcesso(login, novaSenha) {
    const response = await api.post('/auth/primeiro-acesso', { login, nova_senha: novaSenha });
    return response;
  },

  async me() {
    return await api.get('/auth/me');
  },

  setToken(token) {
    api.setToken(token);
  },

  logout() {
    api.setToken(null);
    localStorage.removeItem('usuario');
  },

  getToken() {
    return api.getToken();
  },

  isAuthenticated() {
    return !!api.getToken();
  }
};

export default authService;