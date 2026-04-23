import api from './api';

export const notificacaoService = {
  async listar(apenasNaoLidas = false) {
    const params = apenasNaoLidas ? { apenas_nao_lidas: 'true' } : {};
    return await api.get('/notificacoes', params);
  },

  async marcarComoLida(id) {
    return await api.patch(`/notificacoes/${id}/ler`);
  },

  async marcarTodasComoLidas() {
    return await api.patch('/notificacoes/ler-todas');
  }
};

export default notificacaoService;