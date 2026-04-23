import { useState, useEffect } from 'react'
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa'
import { servicoService } from '../services/servico'
import { useAuth } from '../context/AuthContext'

function Servicos() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [servicos, setServicos] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState('add') // add, edit
  const [selectedServico, setSelectedServico] = useState(null)
  const { usuario } = useAuth()
  
  const [filters, setFilters] = useState({
    busca: ''
  })
  
  const [formData, setFormData] = useState({
    nome: '',
    valor: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await servicoService.listar()
      setServicos(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError('Erro ao carregar serviços')
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

  const handleOpenModal = (mode, serv = null) => {
    setModalMode(mode)
    setSelectedServico(serv)
    if (mode === 'edit' && serv) {
      setFormData({
        nome: serv.nome,
        valor: serv.valor
      })
    } else {
      setFormData({ nome: '', valor: '' })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setSelectedServico(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const payload = {
      nome: formData.nome,
      valor: parseFloat(formData.valor)
    }

    try {
      if (modalMode === 'add') {
        await servicoService.criar(payload)
      } else if (modalMode === 'edit' && selectedServico) {
        await servicoService.atualizar(selectedServico.id, payload)
      }
      handleCloseModal()
      loadData()
    } catch (err) {
      console.error('Erro ao salvar:', err)
      const errorMsg = err.response?.data?.erro || err.message || 'Erro ao salvar serviço'
      alert(errorMsg)
    }
  }

  const handleDelete = async (serv) => {
    if (confirm(`Deseja premanentemente deletar o serviço ${serv.nome}? Estará indisponível para futuras operações.`)) {
      try {
        await servicoService.deletar(serv.id)
        loadData()
      } catch (err) {
        const errorMsg = err.response?.data?.erro || err.message || 'Erro ao excluir serviço'
        alert(errorMsg)
      }
    }
  }

  const filteredServicos = servicos.filter(serv => {
    if (filters.busca) {
      const busca = filters.busca.toLowerCase()
      if (!serv.nome.toLowerCase().includes(busca) && !serv.id.toString().includes(busca)) return false
    }
    return true
  })

  const statsServicos = [
    { icon: 'fa-tools', bgClass: 'bg-blue-light', title: 'Total de Serviços', value: servicos.length },
    { icon: 'fa-hand-holding-dollar', bgClass: 'bg-green-light', title: 'Preço Médio', value: formatCurrency(servicos.length > 0 ? servicos.reduce((acc, s) => acc + s.valor, 0) / servicos.length : 0) },
  ]

  const canManage = usuario?.perfil === 'admin' || usuario?.perfil === 'gerente' || usuario?.perfil === 'superadmin'

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Carregando serviços...</p>
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
        {statsServicos.map((stat, index) => (
          <div key={index} className="card stat-card">
            <div className={`stat-icon ${stat.bgClass}`}>
              <i className={`fas ${stat.icon}`}></i>
            </div>
            <div className="stat-info">
              <h3>{stat.title}</h3>
              <p>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="filters-bar">
        <div className="filter-group">
          <input
            type="text"
            className="filter-input"
            placeholder="Buscar por nome ou ID..."
            value={filters.busca}
            onChange={(e) => setFilters({ ...filters, busca: e.target.value })}
          />
          {canManage && (
            <button type="button" className="btn btn-success" onClick={() => handleOpenModal('add')}>
              <FaPlus /> Novo Serviço
            </button>
          )}
        </div>
      </div>

      <div className="card table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome do Serviço</th>
              <th>Valor Padrão</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredServicos.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center' }}>Nenhum serviço encontrado</td>
              </tr>
            ) : (
              filteredServicos.map((serv) => (
                <tr key={serv.id}>
                  <td>{serv.id}</td>
                  <td><strong>{serv.nome}</strong></td>
                  <td>{formatCurrency(serv.valor)}</td>
                  <td>
                    {canManage && (
                      <>
                        <button
                          type="button"
                          className="action-btn action-btn-edit"
                          onClick={() => handleOpenModal('edit', serv)}
                          title="Editar"
                        >
                          <FaEdit />
                        </button>
                        <button
                          type="button"
                          className="action-btn action-btn-delete"
                          onClick={() => handleDelete(serv)}
                          title="Deletar Serviço"
                        >
                          <FaTrash />
                        </button>
                      </>
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
              {modalMode === 'add' ? 'Cadastrar Novo Serviço' : 'Editar Serviço'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nome do Serviço *</label>
                <input
                  type="text"
                  placeholder="Ex: Carga de bateria"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Valor Padrão (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
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

export default Servicos
