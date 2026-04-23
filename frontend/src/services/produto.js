import api from './api';

export const produtoService = {
  async listar(categoria = null) {
    const params = categoria ? { categoria } : {};
    return await api.get('/produtos', params);
  },

  async buscarPorId(id) {
    return await api.get(`/produtos/${id}`);
  },

  async criar(data) {
    return await api.post('/produtos', {
      nome: data.nome,
      categoria: data.categoria,
      valor_atacado: data.valorAtacado,
      valor_varejo: data.valorVarejo,
    });
  },

  async atualizar(id, data) {
    return await api.put(`/produtos/${id}`, {
      nome: data.nome,
      categoria: data.categoria,
      valor_atacado: data.valorAtacado,
      valor_varejo: data.valorVarejo,
    });
  },

  async deletar(id) {
    return await api.delete(`/produtos/${id}`);
  }
};

export default produtoService;