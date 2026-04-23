import { useState, useEffect } from 'react'
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa'
import { produtoService } from '../services/produto'
import { estoqueService } from '../services/estoque'
import { sucataService } from '../services/sucata'
import { useAuth } from '../context/AuthContext'

function Produtos() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [produtos, setProdutos] = useState([])
  const [estoques, setEstoques] = useState([])
  const [sucatas, setSucatas] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState('add') // add, edit
  const [selectedProduto, setSelectedProduto] = useState(null)
  const { usuario } = useAuth()
  
  const [filters, setFilters] = useState({
    busca: '',
    categoria: ''
  })
  
  const [formData, setFormData] = useState({
    nome: '',
    categoria: '',
    valorAtacado: '',
    valorVarejo: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      // Sincronização em background: não trava o carregamento inicial da página.
      // A sincronização corre 'por baixo dos panos' e os dados são atualizados no Promise.all abaixo.
      estoqueService.sincronizar().catch(err => console.warn('Sync background falhou:', err))
      
      const [produtosData, estoquesData, sucatasData] = await Promise.all([
        produtoService.listar(),
        estoqueService.listarEstoque(),
        sucataService.listar()
      ])
      setProdutos(Array.isArray(produtosData) ? produtosData : [])
      setEstoques(Array.isArray(estoquesData) ? estoquesData : [])
      setSucatas(Array.isArray(sucatasData) ? sucatasData : [])
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError('Erro ao carregar produtos')
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

  const handleOpenModal = (mode, prod = null) => {
    setModalMode(mode)
    setSelectedProduto(prod)
    if (mode === 'edit' && prod) {
      setFormData({
        nome: prod.nome,
        categoria: prod.categoria || '',
        valorAtacado: prod.valor_atacado,
        valorVarejo: prod.valor_varejo
      })
    } else {
      setFormData({ nome: '', categoria: '', valorAtacado: '', valorVarejo: '' })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setSelectedProduto(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const payload = {
      nome: formData.nome,
      categoria: formData.categoria,
      valorAtacado: parseFloat(formData.valorAtacado),
      valorVarejo: parseFloat(formData.valorVarejo)
    }

    try {
      if (modalMode === 'add') {
        await produtoService.criar(payload)
      } else if (modalMode === 'edit' && selectedProduto) {
        await produtoService.atualizar(selectedProduto.id, payload)
      }
      handleCloseModal()
      loadData()
    } catch (err) {
      console.error('Erro ao salvar:', err)
      alert(err.message || 'Erro ao salvar produto')
    }
  }

  const handleDelete = async (prod) => {
    if (confirm(`Deseja premanentemente deletar o produto ${prod.nome}? Estará indisponível para futuras operações.`)) {
      try {
        await produtoService.deletar(prod.id)
        loadData()
      } catch (err) {
        alert(err.message || 'Erro ao excluir produto')
      }
    }
  }

  const getEstoqueQtd = (produtoId) => {
    const e = estoques.find(est => est.produto_id === produtoId)
    return e ? e.qtd_atual : 0
  }

  const getSucataQtd = (produtoId) => {
    // Busca registros de sucata onde o produto_id corresponde ao ID do produto
    return sucatas.filter(s => 
      s.produto_id === produtoId && 
      s.estado === 'disponivel'
    ).length
  }

  const categoriasUnicas = [...new Set(produtos.map(p => p.categoria).filter(Boolean))]

  const filteredProdutos = produtos.filter(prod => {
    if (filters.categoria && prod.categoria !== filters.categoria) return false
    if (filters.busca) {
      const busca = filters.busca.toLowerCase()
      if (!prod.nome.toLowerCase().includes(busca) && !prod.id.toString().includes(busca)) return false
    }
    return true
  })

  const canManage = usuario?.perfil === 'admin' || usuario?.perfil === 'gerente' || usuario?.perfil === 'superadmin'

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Carregando produtos...</p>
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
      <div className="filters-bar">
        <div className="filter-group">
          <input
            type="text"
            className="filter-input"
            placeholder="Buscar por nome ou ID..."
            value={filters.busca}
            onChange={(e) => setFilters({ ...filters, busca: e.target.value })}
          />
          <select
            className="filter-input"
            value={filters.categoria}
            onChange={(e) => setFilters({ ...filters, categoria: e.target.value })}
          >
            <option value="">Todas as Categorias</option>
            {categoriasUnicas.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          {canManage && (
            <button type="button" className="btn btn-success" onClick={() => handleOpenModal('add')}>
              <FaPlus /> Novo Produto
            </button>
          )}
        </div>
      </div>

      <div className="card table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Modelo / Nome do Produto</th>
              <th>Categoria</th>
              <th>Estoque</th>
              <th>Saldo Sucata</th>
              <th>P. Atacado</th>
              <th>P. Varejo</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredProdutos.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center' }}>Nenhum produto encontrado</td>
              </tr>
            ) : (
              filteredProdutos.map((prod) => {
                const qtd = getEstoqueQtd(prod.id)
                const qtdSucata = getSucataQtd(prod.id)
                return (
                  <tr key={prod.id}>
                    <td>{prod.id}</td>
                    <td>
                      {prod.categoria && <span style={{fontSize: '0.85em', color: '#007bff', marginRight: '8px', fontWeight: '600'}}>[{prod.categoria}]</span>}
                      <strong>{prod.nome}</strong>
                    </td>
                    <td>{prod.categoria || '---'}</td>
                    <td>
                      <span className={`badge ${qtd > 0 ? 'badge-success' : 'badge-danger'}`} style={{ minWidth: '60px', textAlign: 'center' }}>
                        {qtd} un
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${qtdSucata > 0 ? 'badge-warning' : ''}`} style={{ minWidth: '60px', textAlign: 'center', background: qtdSucata > 0 ? undefined : '#f1f5f9', color: qtdSucata > 0 ? undefined : '#64748b' }}>
                        {qtdSucata} un
                      </span>
                    </td>
                    <td>{formatCurrency(prod.valor_atacado)}</td>
                    <td>{formatCurrency(prod.valor_varejo)}</td>
                  <td>
                    {canManage && (
                      <>
                        <button
                          type="button"
                          className="action-btn action-btn-edit"
                          onClick={() => handleOpenModal('edit', prod)}
                          title="Editar"
                        >
                          <FaEdit />
                        </button>
                        <button
                          type="button"
                          className="action-btn action-btn-delete"
                          onClick={() => handleDelete(prod)}
                          title="Deletar Produto"
                        >
                          <FaTrash />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={handleCloseModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">
              {modalMode === 'add' ? 'Cadastrar Novo Produto' : 'Editar Produto'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nome do Produto / Modelo *</label>
                <input
                  type="text"
                  placeholder="Nome abreviado oficial"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Categoria</label>
                <input
                  type="text"
                  placeholder="Opcional. Ex: Automotiva"
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Preço de Atacado (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.valorAtacado}
                  onChange={(e) => setFormData({ ...formData, valorAtacado: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Preço de Varejo (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.valorVarejo}
                  onChange={(e) => setFormData({ ...formData, valorVarejo: e.target.value })}
                  required
                />
              </div>
              
              <div className="modal-actions">
                <button type="button" className="btn btn-cancel" onClick={handleCloseModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-success">
                  {modalMode === 'add' ? 'Confirmar' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export default Produtos
