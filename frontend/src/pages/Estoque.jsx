import { useState, useEffect } from 'react'
import { FaPlus, FaEye, FaTrash, FaHandshake, FaUndo, FaEdit } from 'react-icons/fa'
import { estoqueService } from '../services/estoque'
import { produtoService } from '../services/produto'
import { useAuth } from '../context/AuthContext'

function Estoque() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [itens, setItens] = useState([])
  const [produtos, setProdutos] = useState([])
  const [estoques, setEstoques] = useState([]) // Novo estado para sumário
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState('add')
  const [selectedItem, setSelectedItem] = useState(null)
  const { usuario } = useAuth()
  const today = new Date().toLocaleDateString('en-CA')
  const [filters, setFilters] = useState({
    busca: '',
    produtoId: '',
    estado: '',
    inicio: '',
    fim: ''
  })
  const [formData, setFormData] = useState({
    produtoId: '',
    codLote: '',
    estado: 'disponivel',
    observacao: '',
    vendaId: '',
    quantidade: 1
  })

  useEffect(() => {
    loadData()
  }, [filters.produtoId, filters.estado, filters.inicio, filters.fim])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {
        produto_id: filters.produtoId,
        estado: filters.estado,
        inicio: filters.inicio,
        fim: filters.fim
      }
      const [itensData, produtosData, estoquesData] = await Promise.all([
        estoqueService.listarItens(params),
        produtoService.listar(),
        estoqueService.listarEstoque()
      ])
      setItens(Array.isArray(itensData) ? itensData : [])
      setProdutos(Array.isArray(produtosData) ? produtosData : [])
      setEstoques(Array.isArray(estoquesData) ? estoquesData : [])
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError('Erro ao carregar dados do estoque')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '---'
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getStatusClass = (estado) => {
    switch (estado) {
      case 'disponivel': return 'status-in-stock'
      case 'emprestado': return 'status-low-stock'
      case 'reservado': return 'status-low-stock'
      case 'vendido': return 'status-out-stock'
      case 'indisponivel': return 'status-out-stock'
      case 'reembolsado': return 'status-low-stock'
      case 'fora_estoque': return 'status-out-stock'
      default: return ''
    }
  }

  const getStatusText = (estado) => {
    switch (estado) {
      case 'disponivel': return 'Disponível'
      case 'emprestado': return 'Emprestado'
      case 'reservado': return 'Reservado'
      case 'vendido': return 'Vendido'
      case 'reembolsado': return 'Reembolsada'
      case 'indisponivel': return 'Indisponível'
      case 'fora_estoque': return 'Fora de Estoque'
      default: return estado || '---'
    }
  }

  const formatCurrency = (value) => {
    if (!value && value !== 0) return '---'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const filteredItens = itens.filter(item => {
    // Agora o filtro de produto, estado e período é feito no back-end
    // Mantemos apenas a busca local aqui
    if (filters.busca) {
      const busca = filters.busca.toLowerCase()
      const matchesId = `#${item.id}`.toLowerCase().includes(busca)
      const matchesLote = (item.cod_lote || '').toLowerCase().includes(busca)
      const matchesProduto = (item.produto?.nome || '').toLowerCase().includes(busca)
      if (!matchesId && !matchesLote && !matchesProduto) return false
    }
    return true
  })

  // Cálculos para o sumário
  const totais = {
    total: itens.filter(i => i.estado === 'disponivel').length,
    reservado: itens.filter(i => i.estado === 'reservado').length,
    valor: itens.filter(i => i.estado === 'disponivel').reduce((acc, i) => acc + (i.produto?.valor_atacado || 0), 0)
  }

  const categoriasUnicas = [...new Set(produtos.map(p => p.categoria).filter(Boolean))]

  const handleOpenModal = (mode, item = null) => {
    setModalMode(mode)
    setSelectedItem(item)
    if (item) {
      setFormData({
        produtoId: item.produto_id || '',
        codLote: item.cod_lote || '',
        estado: item.estado || 'disponivel',
        observacao: item.observacao || '',
        vendaId: item.estado === 'disponivel' ? '' : (item.venda_id || '')
      })
    } else {
      setFormData({ produtoId: '', codLote: '', estado: 'disponivel', observacao: '', vendaId: '', quantidade: 1 })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setSelectedItem(null)
    setFormData({ produtoId: '', codLote: '', estado: 'disponivel', vendaId: '', quantidade: 1 })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (modalMode === 'entrada') {
        await estoqueService.entradaEstoque({
          produtoId: parseInt(formData.produtoId),
          codLote: formData.codLote,
          quantidade: parseInt(formData.quantidade || 1)
        })
      } else if (modalMode === 'editar' && selectedItem) {
        if (!window.confirm("Confirmar alterações nas configurações deste item?")) {
          return;
        }
        const vId = formData.vendaId ? parseInt(formData.vendaId) : 0
        await estoqueService.editarItem(selectedItem.id, {
          produtoId: parseInt(formData.produtoId),
          codLote: formData.codLote,
          estado: formData.estado,
          observacao: formData.observacao,
          venda_id: vId
        })
      } else if (modalMode === 'saida' && selectedItem) {
        await estoqueService.saidaEstoque(selectedItem.id)
      }
      handleCloseModal()
      loadData()
    } catch (err) {
      console.error('Erro ao salvar:', err)
      alert(err.message || 'Erro ao realizar operação')
    }
  }

  const canManage = usuario?.perfil === 'admin' || usuario?.perfil === 'gerente' || usuario?.perfil === 'superadmin'

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Carregando estoque...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-container">
        <p>{error}</p>
        <button onClick={loadData} className="btn btn-primary">Tentar novamente</button>
      </div>
    )
  }

  return (
    <>
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="card stat-card">
          <div className="stat-icon bg-blue-light">
            <i className="fas fa-boxes"></i>
          </div>
          <div className="stat-info">
            <h3>Total em Estoque</h3>
            <p>{totais.total} unidades</p>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon bg-yellow-light">
            <i className="fas fa-clock"></i>
          </div>
          <div className="stat-info">
            <h3>Aguardando Retirada</h3>
            <p>{totais.reservado} unidades</p>
            <small style={{ color: '#64748b' }}>Itens em vendas pendentes</small>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon bg-green-light">
            <i className="fas fa-hand-holding-usd"></i>
          </div>
          <div className="stat-info">
            <h3>Investimento Total</h3>
            <p>{formatCurrency(totais.valor)}</p>
          </div>
        </div>
      </div>

      <div className="filters-bar">
        <div className="filter-group">
          <input
            type="text"
            className="filter-input"
            placeholder="Buscar por ID ou Lote..."
            value={filters.busca}
            onChange={(e) => setFilters({ ...filters, busca: e.target.value })}
          />
          <select
            className="filter-input"
            value={filters.produtoId}
            onChange={(e) => setFilters({ ...filters, produtoId: e.target.value })}
          >
            <option value="">Todos os Produtos</option>
            {produtos
              .map(p => (
                <option key={p.id} value={p.id}>{p.nome} [{p.categoria}]</option>
              ))}
          </select>
          <select
            className="filter-input"
            value={filters.estado}
            onChange={(e) => setFilters({ ...filters, estado: e.target.value })}
          >
            <option value="">Status (Todos)</option>
            <option value="disponivel">Disponível</option>
            <option value="reservado">Reservado</option>
            <option value="reembolsado">Reembolsada</option>
            <option value="vendido">Vendido</option>
            <option value="fora_estoque">Fora de Estoque</option>
          </select>
          <div className="filter-date-group">
            <input
              type="date"
              className="filter-input"
              title="Data Início"
              max={today}
              value={filters.inicio}
              onChange={(e) => setFilters({ ...filters, inicio: e.target.value })}
            />
            <span style={{ color: '#64748b' }}>até</span>
            <input
              type="date"
              className="filter-input"
              title="Data Fim"
              max={today}
              value={filters.fim}
              onChange={(e) => setFilters({ ...filters, fim: e.target.value })}
            />
          </div>
        </div>
        {canManage && (
          <button type="button" className="btn btn-success" onClick={() => handleOpenModal('entrada')}>
            <FaPlus /> Entrada de Estoque
          </button>
        )}
      </div>

      <div className="card table-container">
        <table>
          <thead>
            <tr>
              <th>ID Item</th>
              <th>Data Entrada</th>
              <th>Produto</th>
              <th>Cód. Lote</th>
              <th>Status</th>
              <th>Valor Unit.</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredItens.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center' }}>Nenhum item encontrado</td>
              </tr>
            ) : (
              filteredItens.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 'bold' }}>#{item.id}</td>
                  <td style={{ fontSize: '0.9em', color: '#64748b' }}>{formatDate(item.created_at)}</td>
                  <td>
                    {item.produto?.nome || `Produto ${item.produto_id}`}
                    {item.produto?.categoria && <span style={{fontSize: '0.85em', color: '#64748b', marginLeft: '6px', fontWeight: '500'}}>[{item.produto.categoria}]</span>}
                  </td>
                  <td>{item.cod_lote || '---'}</td>
                  <td>
                    <span className={`badge ${item.estado === 'disponivel' ? 'badge-success' : (item.estado === 'reservado' || item.estado === 'emprestado' ? 'badge-warning' : 'badge-danger')}`}>
                      {getStatusText(item.estado)}
                    </span>
                  </td>
                  <td>{formatCurrency(item.produto?.valor_varejo)}</td>
                  <td>
                    {canManage && (
                      <button
                        type="button"
                        className="action-btn action-btn-view"
                        onClick={() => handleOpenModal('editar', item)}
                        title="Editar Item"
                      >
                        <FaEdit />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={handleCloseModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">
              {modalMode === 'entrada' && 'Registrar Entrada de Estoque'}
              {modalMode === 'saida' && 'Registrar Saída de Estoque'}
              {modalMode === 'editar' && 'Editar Configurações do Item'}
            </h3>

            {modalMode === 'editar' && selectedItem ? (
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>ID Numérico</label>
                  <input type="text" value={`#${selectedItem.id}`} readOnly style={{ background: '#f0f0f0' }} />
                </div>
                <div className="form-group">
                  <label>Produto Referência (Fixo)</label>
                  <input type="text" value={`${selectedItem.produto?.nome || '---'} [${selectedItem.produto?.categoria || 'N/A'}]`} readOnly style={{ background: '#f0f0f0' }} />
                </div>
                <div className="form-group">
                  <label>Código do Lote Comercial *</label>
                  <input
                    type="text"
                    placeholder="Ex: LT2024-A"
                    value={formData.codLote}
                    onChange={(e) => setFormData({ ...formData, codLote: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Situação e Estado Base <span style={{ color: 'red' }}>*</span></label>
                  <select
                    className="filter-input-full"
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                    required
                    disabled={selectedItem?.estado === 'reservado'}
                    title={selectedItem?.estado === 'reservado' ? "Itens atrelados a uma Venda Pendente não podem ter o estado alterado aqui" : ""}
                  >
                    <option value="disponivel">Disponível</option>
                    <option value="emprestado">Emprestado</option>
                    <option value="reembolsado">Reembolsada (Devolução)</option>
                    <option value="fora_estoque">Fora de Estoque</option>
                    {(formData.estado === 'vendido' || selectedItem?.estado === 'disponivel') && (
                      <option value="vendido">Vendido</option>
                    )}
                    {selectedItem?.estado === 'reservado' && (
                      <option value="reservado">Reservado (Em Venda)</option>
                    )}
                  </select>
                  {(formData.estado === 'reembolsado' || formData.estado === 'emprestado' || formData.estado === 'fora_estoque' || selectedItem?.estado === 'reembolsado') && (
                    <div className="form-group" style={{ marginTop: '15px' }}>
                      <label>
                        {formData.estado === 'reembolsado' ? 'Observação do Reembolso' : 
                         formData.estado === 'emprestado' ? 'Detalhes do Empréstimo' : 
                         formData.estado === 'fora_estoque' ? 'Motivo da Saída/Baixa' : 'Observação da Alteração'}
                        <span style={{ color: 'red' }}> *</span>
                      </label>
                      <textarea
                        className="filter-input-full"
                        rows="3"
                        placeholder={
                          formData.estado === 'reembolsado' ? "Motivo do reembolso ou estado da peça..." : 
                          formData.estado === 'emprestado' ? "Para quem? Qual o prazo previsto?" :
                          formData.estado === 'fora_estoque' ? "Por que este item está saindo de estoque? (Ex: Sucata, perda, etc)" :
                          "Descreva o motivo desta alteração..."
                        }
                        value={formData.observacao}
                        onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                        style={{ padding: '10px', width: '100%', borderRadius: '4px', border: '1px solid #ddd' }}
                        required
                      />
                    </div>
                  )}

                  {formData.estado === 'vendido' && (
                    <div className="form-group" style={{ marginTop: '15px' }}>
                      <label style={{ fontWeight: '700' }}>
                        ID da Venda {selectedItem?.estado !== 'vendido' && '(Opcional)'}
                      </label>
                      <input
                        type="number"
                        className="filter-input-full"
                        placeholder="ID da Venda (Ex: 123)"
                        value={formData.vendaId || ''}
                        onChange={(e) => setFormData({ ...formData, vendaId: e.target.value })}
                        disabled={selectedItem?.estado === 'vendido'}
                        style={{ marginTop: '5px', backgroundColor: selectedItem?.estado === 'vendido' ? '#f1f5f9' : 'white', cursor: selectedItem?.estado === 'vendido' ? 'not-allowed' : 'text' }}
                      />
                      <small style={{ color: '#be123c', marginTop: '8px', display: 'block', fontSize: '0.75rem' }}>
                        {selectedItem?.estado === 'vendido' ? 
                          '⚠️ Para trocar de venda, mude primeiro para "Disponível" para estornar o valor atual.' : 
                          '⚠️ Ao informar o ID, este item será adicionado à lista de itens da venda informada.'}
                      </small>
                    </div>
                  )}
                  {selectedItem?.estado === 'reservado' && (
                    <span style={{ fontSize: '0.8rem', color: '#e11d48', marginTop: '4px', display: 'block' }}>Este item está bloqueado pois pertence a uma venda pendente.</span>
                  )}
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-cancel" onClick={handleCloseModal}>
                    Descartar Edição
                  </button>
                  <button type="submit" className="btn btn-success">
                    Salvar Modificações
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmit}>
                {modalMode === 'entrada' && (
                  <>
                    <div className="form-group">
                      <label>Produto *</label>
                      <select
                        className="filter-input-full"
                        value={formData.produtoId}
                        onChange={(e) => setFormData({ ...formData, produtoId: e.target.value })}
                        required
                      >
                        <option value="">Selecione um produto</option>
                        {produtos.map(p => (
                          <option key={p.id} value={p.id}>{p.nome} [{p.categoria}]</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Código do Lote *</label>
                      <input
                        type="text"
                        placeholder="Ex: LT2024-A"
                        value={formData.codLote}
                        onChange={(e) => setFormData({ ...formData, codLote: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Quantidade a Registrar *</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        placeholder="Ex: 10"
                        value={formData.quantidade}
                        onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })}
                        required
                      />
                      <small style={{ color: '#64748b' }}>Cada unidade será registrada com um ID único.</small>
                    </div>
                  </>
                )}

                {modalMode === 'saida' && selectedItem && (
                  <div className="form-group">
                    <label>Item</label>
                    <input
                      type="text"
                      value={`#${selectedItem.id} - ${selectedItem.produto?.nome || ''}`}
                      readOnly
                    />
                    <p style={{ marginTop: '10px', color: '#666' }}>
                      Esta ação registrará a saída definitiva deste item do estoque.
                    </p>
                  </div>
                )}

                <div className="modal-actions">
                  <button type="button" className="btn btn-cancel" onClick={handleCloseModal}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-success">
                    Confirmar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default Estoque