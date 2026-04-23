import api from './api';

export const vendaService = {
  async listar() {
    return await api.get('/vendas');
  },

  async buscarPorId(id) {
    return await api.get(`/vendas/${id}`);
  },

  async criar(data) {
    // data.itens deve ser um array de { produto_id, tipo_preco }
    return await api.post('/vendas', {
      nome_cliente: data.nome_cliente,
      empresa: data.empresa || '',
      documento_cliente: data.documento_cliente || '',
      telefone_cliente: data.telefone_cliente || '',
      observacoes: data.observacoes || '',
      troco_devolvido: data.troco_devolvido || 0,
      itens: data.itens,
      pagamentos: data.pagamentos || []
    });
  },

  async atualizar(id, data) {
    return await api.put(`/vendas/${id}`, {
      nome_cliente: data.nome_cliente,
      empresa: data.empresa || '',
      documento_cliente: data.documento_cliente || '',
      telefone_cliente: data.telefone_cliente || '',
      observacoes: data.observacoes || '',
      troco_devolvido: data.troco_devolvido || 0,
      itens: data.itens,
      pagamentos: data.pagamentos || []
    });
  },

  async confirmar(id) {
    return await api.patch(`/vendas/${id}/confirmar`);
  },

  async cancelar(id) {
    return await api.patch(`/vendas/${id}/cancelar`);
  },

  async devolver(id) {
    return await api.patch(`/vendas/${id}/devolver`);
  },

  async atualizarObservacoes(id, observacoes) {
    return await api.patch(`/vendas/${id}/observacoes`, { observacoes });
  },

  async gerarComprovante(id) {
    const url = `${api.baseUrl}/vendas/${id}/comprovante`;
    const response = await fetch(url, {
      method: "GET",
      headers: api.getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.erro || "Erro ao gerar comprovante");
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `comprovante_venda_${id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  }
};

export default vendaService;