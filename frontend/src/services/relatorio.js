import api from './api'

export const relatorioService = {
  // Busca os dados agregados de vendas para alimentar os gráficos
  obterDadosVendas: async (inicio, fim) => {
    const params = {}
    if (inicio) params.inicio = inicio
    if (fim) params.fim = fim
    
    return await api.get('/relatorios/vendas/dados', params)
  },

  // Faz o download do PDF de vendas (seguindo o padrão do vendaService.gerarComprovante)
  downloadPDFVendas: async (inicio, fim) => {
    const params = new URLSearchParams()
    if (inicio) params.append('inicio', inicio)
    if (fim) params.append('fim', fim)

    const url = `${api.baseUrl}/relatorios/vendas/pdf?${params.toString()}`
    const response = await fetch(url, {
      method: "GET",
      headers: api.getHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.erro || "Erro ao gerar PDF de vendas");
    }

    const blob = await response.blob()
    const blobUrl = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = blobUrl
    link.download = `relatorio_vendas_${new Date().toISOString().split('T')[0]}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(blobUrl)
  },

  // Faz o download do PDF de estoque + histórico mensal
  downloadPDFEstoque: async (inicio, fim) => {
    const params = new URLSearchParams()
    if (inicio) params.append('inicio', inicio)
    if (fim) params.append('fim', fim)

    const url = `${api.baseUrl}/relatorios/estoque/pdf?${params.toString()}`
    const response = await fetch(url, {
      method: "GET",
      headers: api.getHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.erro || "Erro ao gerar PDF de estoque");
    }

    const blob = await response.blob()
    const blobUrl = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = blobUrl
    link.download = `relatorio_estoque_${new Date().toISOString().split('T')[0]}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(blobUrl)
  }
}
