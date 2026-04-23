import api from './api'

export const configuracaoService = {
  async obterConfiguracoes() {
    const response = await api.get('/configuracoes')
    return response
  },

  async atualizarConfiguracoes(data) {
    const response = await api.put('/configuracoes', {
      alerta_estoque_baixo: parseInt(data.estoqueMinimo),
      preco_sucata_kg: parseFloat(data.precoSucata)
    })
    return response
  }
}
