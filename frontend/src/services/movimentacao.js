import api from './api';

export const movimentacaoService = {
  async listar(params = {}) {
    return await api.get('/movimentacoes', params);
  },

  async listarPorItem(itemId) {
    return await api.get('/movimentacoes', { item_id: itemId });
  },

  async listarPorProduto(produtoId) {
    return await api.get('/movimentacoes', { produto_id: produtoId });
  },

  async listarPorTipo(tipo) {
    return await api.get('/movimentacoes', { tipo });
  },

  async listarPorPeriodo(inicio, fim) {
    return await api.get('/movimentacoes', { inicio, fim });
  }
};

export const movimentacaoSucataService = {
  async listar(params = {}) {
    return await api.get('/movimentacoes/sucata', params);
  },

  async listarPorSucata(sucataId) {
    return await api.get('/movimentacoes/sucata', { sucata_id: sucataId });
  },

  async listarPorTipo(tipo) {
    return await api.get('/movimentacoes/sucata', { tipo });
  },

  async listarPorPeriodo(inicio, fim) {
    return await api.get('/movimentacoes/sucata', { inicio, fim });
  }
};

export default movimentacaoService;