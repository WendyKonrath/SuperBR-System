import api from './api';

export const usuarioService = {
  async listar() {
    return await api.get('/usuarios');
  },

  async buscarPorId(id) {
    return await api.get(`/usuarios/${id}`);
  },

  async criar(data) {
    return await api.post('/usuarios', {
      nome: data.nome,
      login: data.login,
      perfil: data.perfil,
    });
  },

  async atualizar(id, data) {
    return await api.put(`/usuarios/${id}`, {
      nome: data.nome,
      perfil: data.perfil,
    });
  },

  async desativar(id) {
    return await api.patch(`/usuarios/${id}/desativar`);
  },

  async ativar(id) {
    return await api.patch(`/usuarios/${id}/ativar`);
  },

  async resetarSenha(id) {
    return await api.patch(`/usuarios/${id}/resetar-senha`);
  }
};

export default usuarioService;