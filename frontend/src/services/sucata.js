import api from './api';

export const sucataService = {
  async listar() {
    return await api.get('/sucata');
  },

  async buscarPorId(id) {
    return await api.get(`/sucata/${id}`);
  },

  async entradaSucata(data) {
    return await api.post('/sucata/entrada', {
      produto_id: data.produtoId || null,
      descricao: data.descricao || "",
      peso: data.peso,
      venda_id: data.vendaId || null
    });
  },

  async editarLote(id, data) {
    return await api.put(`/sucata/lotes/${id}`, {
      produto_id: data.produtoId || null,
      descricao: data.descricao || "",
      peso: data.peso,
      venda_id: data.vendaId || null,
      estado: data.estado
    });
  },

  async deletarLote(id) {
    return await api.delete(`/sucata/lotes/${id}`);
  }
};

export default sucataService;