import { useState, useEffect } from 'react'
import { FaPlus, FaTrash, FaEdit, FaBatteryFull } from 'react-icons/fa'
import { sucataService } from '../services/sucata'
import { produtoService } from '../services/produto'
import { useAuth } from '../context/AuthContext'

function Sucata() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sucatas, setSucatas] = useState([])
  const [produtos, setProdutos] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState('entrada') // entrada, editar
  const [formData, setFormData] = useState({
    produtoId: '',
    descricao: '',
    peso: '',
    vendaId: '',
    estado: 'disponivel',
    sucataId: null
  })
  const { usuario } = useAuth()
  const [filters, setFilters] = useState({ 
    busca: '',
    produtoId: '',
    estado: '',
    pesoMin: '',
    pesoMax: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [sucataData, produtosData] = await Promise.all([
        sucataService.listar(),
        produtoService.listar()
      ])
      setSucatas(Array.isArray(sucataData) ? sucataData : [])
      setProdutos(Array.isArray(produtosData) ? produtosData : [])
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError('Erro ao carregar dados de sucata')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0)
  }

  const sucatasDisponiveis = sucatas.filter(s => s && s.estado === 'disponivel')
  const totalPeso = sucatasDisponiveis.reduce((acc, item) => acc + (parseFloat(item.peso) || 0), 0)
  const totalValor = sucatasDisponiveis.reduce((acc, item) => acc + (parseFloat(item.valor_total) || 0), 0)
  const totalQtd = sucatasDisponiveis.length

  const filteredSucatas = sucatas.filter(item => {
    if (!item) return false
    
    // Filtro de Produto
    if (filters.produtoId && item.produto_id !== parseInt(filters.produtoId)) return false
    
    // Filtro de Status
    if (filters.estado && item.estado !== filters.estado) return false

    // Busca Textual
    if (filters.busca) {
      const busca = filters.busca.toLowerCase()
      const matchesId = `#${item.id}`.toLowerCase().includes(busca)
      const matchesProduto = (item.produto?.nome || '').toLowerCase().includes(busca)
      const matchesCat = (item.produto?.categoria || '').toLowerCase().includes(busca)
      if (!matchesId && !matchesProduto && !matchesCat) return false
    }
    
    // Filtro de Faixa de Peso
    if (filters.pesoMin && item.peso < parseFloat(filters.pesoMin)) return false
    if (filters.pesoMax && item.peso > parseFloat(filters.pesoMax)) return false

    return true
  })

  const handleOpenModal = (mode, sucataItem = null) => {
    setModalMode(mode)
    if (sucataItem) {
      setFormData({ 
        produtoId: sucataItem.produto_id ? sucataItem.produto_id.toString() : '',
        descricao: sucataItem.descricao || '',
        peso: sucataItem.peso.toString(), 
        vendaId: sucataItem.venda_id ? sucataItem.venda_id.toString() : '',
        estado: sucataItem.estado, 
        sucataId: sucataItem.id 
      })
    } else {
      setFormData({ produtoId: '', descricao: '', peso: '', vendaId: '', estado: 'disponivel', sucataId: null })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setFormData({ produtoId: '', quantidade: '', vendaId: '', estado: 'disponivel', sucataId: null })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Se não tem produtoId, obriga a ter descrição
    if (!formData.produtoId && !formData.descricao.trim()) {
      alert('Selecione uma bateria ou escreva um nome/descrição para a sucata.')
      return
    }

    if (!formData.peso) {
      alert('Informe o peso da sucata.')
      return
    }

    try {
      const payload = {
        produtoId: formData.produtoId ? parseInt(formData.produtoId) : null,
        descricao: formData.descricao,
        peso: parseFloat(formData.peso.toString().replace(',', '.')),
        vendaId: formData.vendaId ? parseInt(formData.vendaId) : null,
        estado: formData.estado
      }

      if (modalMode === 'entrada') {
        await sucataService.entradaSucata(payload)
      } else if (modalMode === 'editar') {
        await sucataService.editarLote(formData.sucataId, payload)
      }
      handleCloseModal()
      loadData()
    } catch (err) {
      console.error('Erro ao salvar:', err)
      alert(err.message || 'Erro ao realizar operação')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este lote de sucata? Esta ação não pode ser desfeita.')) {
      return
    }

    try {
      await sucataService.deletarLote(id)
      loadData()
    } catch (err) {
      console.error('Erro ao excluir:', err)
      alert(err.message || 'Erro ao excluir lote')
    }
  }

  const canManage = usuario?.perfil === 'admin' || usuario?.perfil === 'gerente' || usuario?.perfil === 'superadmin'

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Carregando sucata...</p>
      </div>
    )
  }

  return (
    <>
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="card stat-card">
          <div className="stat-icon bg-blue-light">
            <i className="fas fa-weight-hanging"></i>
          </div>
          <div className="stat-info">
            <h3>Peso Total em Estoque</h3>
            <p>{totalPeso.toFixed(1)} kg</p>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon bg-green-light">
            <i className="fas fa-hand-holding-usd"></i>
          </div>
          <div className="stat-info">
            <h3>Valor Estimado</h3>
            <p>{formatCurrency(totalValor)}</p>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon bg-yellow-light" style={{ backgroundColor: '#fff7ed', color: '#ea580c' }}>
            <i className="fas fa-boxes"></i>
          </div>
          <div className="stat-info">
            <h3>Sucatas em Estoque</h3>
            <p>{totalQtd} unidades</p>
          </div>
        </div>
      </div>

      <div className="filters-bar">
        <div className="filter-group">
          <input
            type="text"
            className="filter-input"
            placeholder="Buscar por ID ou Nome..."
            value={filters.busca}
            onChange={(e) => setFilters({ ...filters, busca: e.target.value })}
          />
          <select
            className="filter-input"
            value={filters.produtoId}
            onChange={(e) => setFilters({ ...filters, produtoId: e.target.value })}
          >
            <option value="">Status (Todos os Produtos)</option>
            {produtos.map(p => (
              <option key={p.id} value={p.id}>{p.nome} [{p.categoria}]</option>
            ))}
          </select>
          <select
            className="filter-input"
            value={filters.estado}
            onChange={(e) => setFilters({ ...filters, estado: e.target.value })}
          >
            <option value="">Situação (Todas)</option>
            <option value="disponivel">Disponível</option>
            <option value="aguardando_venda">Aguardando Venda</option>
            <option value="reembolsada">Reembolsada</option>
            <option value="fora_de_estoque">Fora de Estoque</option>
          </select>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center', backgroundColor: '#f8fafc', padding: '2px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', height: '38px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginRight: '4px', whiteSpace: 'nowrap' }}>Peso (kg):</span>
            <input
              type="number"
              className="filter-input"
              style={{ width: '60px', border: 'none', background: 'transparent', padding: '0', height: '100%', boxShadow: 'none' }}
              placeholder="Min"
              value={filters.pesoMin}
              onChange={(e) => setFilters({ ...filters, pesoMin: e.target.value })}
            />
            <span style={{ color: '#cbd5e1' }}>|</span>
            <input
              type="number"
              className="filter-input"
              style={{ width: '60px', border: 'none', background: 'transparent', padding: '0', height: '100%', boxShadow: 'none' }}
              placeholder="Max"
              value={filters.pesoMax}
              onChange={(e) => setFilters({ ...filters, pesoMax: e.target.value })}
            />
          </div>
        </div>
        {canManage && (
          <button
            type="button"
            className="btn btn-success"
            onClick={() => handleOpenModal('entrada')}
          >
            <FaPlus /> Registrar Entrada
          </button>
        )}
      </div>

      <div className="card table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Bateria / Modelo</th>
              <th>Origem (Venda)</th>
              <th>Status</th>
              <th>Peso (kg)</th>
              <th>Preço (kg)</th>
              <th>Total</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredSucatas.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center' }}>Nenhum registro encontrado</td>
              </tr>
            ) : (
              filteredSucatas.map((item, index) => (
                <tr key={index}>
                  <td style={{ fontWeight: 'bold' }}>#{item.id}</td>
                  <td>
                    {item.produto && item.produto.id ? (
                      <>
                        <strong>{item.produto.nome}</strong>
                        {item.produto.categoria && <span style={{fontSize: '0.85em', color: '#64748b', marginLeft: '6px', fontWeight: '500'}}>[{item.produto.categoria}]</span>}
                      </>
                    ) : (
                      <span style={{ color: '#111827', fontWeight: '600' }}>
                        {item.descricao || '(Sem nome definido)'}
                      </span>
                    )}
                  </td>
                  <td>
                    {item.venda_id ? (
                      <span style={{ color: '#10b981', fontWeight: '600' }}>Venda #{item.venda_id}</span>
                    ) : (
                      <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '500' }}>Registro Manual</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${
                      item.estado === 'disponivel' ? 'badge-success' : 
                      item.estado === 'aguardando_venda' ? 'badge-warning' : 
                      item.estado === 'reembolsada' ? 'badge-danger' :
                      'badge-danger'
                    }`}>
                      {item.estado === 'disponivel' ? 'Disponível' : 
                       item.estado === 'aguardando_venda' ? 'Aguardando Venda' : 
                       item.estado === 'reembolsada' ? 'Reembolsada' :
                       'Fora de Estoque'}
                    </span>
                  </td>
                  <td>{item.peso?.toFixed(2)}</td>
                  <td>{formatCurrency(item.preco_por_kg)}</td>
                  <td><span style={{ fontWeight: 'bold' }}>{item.estado === 'disponivel' ? formatCurrency(item.valor_total) : 'R$ 0,00'}</span></td>
                  <td>
                    {canManage && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="action-btn action-btn-edit"
                          onClick={() => handleOpenModal('editar', item)}
                          title="Editar Lote"
                        >
                          <FaEdit />
                        </button>
                        <button
                          type="button"
                          className="action-btn action-btn-delete"
                          onClick={() => handleDelete(item.id)}
                          title="Excluir Lote"
                        >
                          <FaTrash />
                        </button>
                      </div>
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
              {modalMode === 'entrada' ? 'Registrar Entrada de Sucata' : `Editar Lote #${formData.sucataId}`}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Selecionar Bateria / Modelo (Opcional)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    className="filter-input-full"
                    value={formData.produtoId}
                    onChange={(e) => setFormData({ ...formData, produtoId: e.target.value })}
                    style={{ flex: 1 }}
                  >
                    <option value="">Nenhum (Entrada Manual)</option>
                    {produtos.map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        [{prod.categoria || 'S/C'}] {prod.nome}
                      </option>
                    ))}
                  </select>
                  {formData.produtoId && (
                    <button 
                      type="button" 
                      className="btn btn-cancel" 
                      onClick={() => setFormData({ ...formData, produtoId: '' })}
                      title="Remover seleção"
                      style={{ padding: '0 15px' }}
                    >
                      <FaTrash />
                    </button>
                  )}
                </div>
              </div>

              {!formData.produtoId && (
                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label>Nome / Descrição da Sucata *</label>
                  <input
                    type="text"
                    placeholder="Ex: Bateria Tracionária 45Ah"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    required={!formData.produtoId}
                  />
                </div>
              )}
              
              <div className="form-group">
                <label>Peso (KG) *</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 5.5"
                  min="0"
                  value={formData.peso}
                  onChange={(e) => setFormData({ ...formData, peso: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>ID da Venda (Opcional)</label>
                <input
                  type="number"
                  placeholder="Ex: 123"
                  min="1"
                  value={formData.vendaId}
                  onChange={(e) => setFormData({ ...formData, vendaId: e.target.value })}
                />
              </div>

              {modalMode === 'editar' && (
                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label>Situação / Estado do Lote</label>
                  <select 
                    className="filter-input-full"
                    value={formData.estado} 
                    onChange={(e) => setFormData({...formData, estado: e.target.value})}
                  >
                    <option value="disponivel">Disponível</option>
                    <option value="aguardando_venda">Aguardando Venda</option>
                    <option value="reembolsada">Reembolsada</option>
                    <option value="fora_de_estoque">Fora de Estoque</option>
                  </select>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-cancel" onClick={handleCloseModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-success">
                  {modalMode === 'entrada' ? 'Confirmar Entrada' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export default Sucata