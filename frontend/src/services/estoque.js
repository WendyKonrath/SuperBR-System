import api from './api';

export const estoqueService = {
  async listarItens(params = {}) {
    return await api.get('/estoque/itens', params);
  },

  async buscarItemPorId(id) {
    return await api.get(`/estoque/itens/${id}`);
  },

  async listarEstoque() {
    return await api.get('/estoque');
  },

  async buscarEstoquePorProduto(produtoId) {
    return await api.get(`/estoque/produto/${produtoId}`);
  },

  async entradaEstoque(data) {
    return await api.post('/estoque/entrada', {
      produto_id: data.produtoId,
      cod_lote: data.codLote,
      quantidade: data.quantidade
    });
  },

  async editarItem(id, data) {
    return await api.put(`/estoque/itens/${id}`, {
      produto_id: data.produtoId,
      cod_lote: data.codLote,
      estado: data.estado,
      observacao: data.observacao,
      venda_id: data.venda_id
    });
  },

  async saidaEstoque(itemId) {
    return await api.post('/estoque/saida', { item_id: itemId });
  },

  async devolverItem(id) {
    return await api.patch(`/estoque/itens/${id}/devolver`);
  },

  async emprestarItem(id) {
    return await api.patch(`/estoque/itens/${id}/emprestar`);
  },

  async devolverEmprestimo(id) {
    return await api.patch(`/estoque/itens/${id}/devolver-emprestimo`);
  },
  
  async sincronizar() {
    return await api.post('/estoque/sincronizar');
  }
};

export default estoqueService;