import api from './api';

export const servicoService = {
  async listar() {
    return await api.get('/servicos');
  },

  async buscarPorId(id) {
    return await api.get(`/servicos/${id}`);
  },

  async criar(data) {
    return await api.post('/servicos', data);
  },

  async atualizar(id, data) {
    return await api.put(`/servicos/${id}`, data);
  },

  async deletar(id) {
    return await api.delete(`/servicos/${id}`);
  }
};

export default servicoService;
