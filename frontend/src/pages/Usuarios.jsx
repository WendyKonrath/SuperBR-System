import { useState, useEffect } from 'react'
import { FaPlus, FaBan, FaCheck, FaKey, FaEdit } from 'react-icons/fa'
import { usuarioService } from '../services/usuario'
import { useAuth } from '../context/AuthContext'

function Usuarios() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [usuarios, setUsuarios] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState('add') // add, edit
  const [selectedUser, setSelectedUser] = useState(null)
  const { usuario: currentUser } = useAuth()
  
  const [formData, setFormData] = useState({
    nome: '',
    login: '',
    perfil: 'vendas'
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await usuarioService.listar()
      setUsuarios(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError('Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (mode, user = null) => {
    setModalMode(mode)
    setSelectedUser(user)
    if (mode === 'edit' && user) {
      setFormData({
        nome: user.nome,
        login: user.login,
        perfil: user.perfil
      })
    } else {
      setFormData({ nome: '', login: '', perfil: 'vendas' })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setSelectedUser(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (modalMode === 'add') {
        await usuarioService.criar(formData)
      } else if (modalMode === 'edit' && selectedUser) {
        await usuarioService.atualizar(selectedUser.id, formData)
      }
      handleCloseModal()
      loadData()
    } catch (err) {
      console.error('Erro ao salvar:', err)
      alert(err.message || 'Erro ao salvar usuário')
    }
  }

  const handleToggleActive = async (user) => {
    if (user.id === currentUser?.id) {
      alert('Você não pode desativar seu próprio usuário.')
      return
    }
    
    if (confirm(`Deseja ${user.ativo ? 'desativar' : 'ativar'} o usuário ${user.nome}?`)) {
      try {
        if (user.ativo) {
          await usuarioService.desativar(user.id)
        } else {
          await usuarioService.ativar(user.id)
        }
        loadData()
      } catch (err) {
        alert(err.message || 'Erro ao alterar status do usuário')
      }
    }
  }

  const handleResetPassword = async (user) => {
    if (confirm(`Atenção: Deseja redefinir a senha do usuário ${user.nome}?\nA senha será removida e o usuário deverá definir uma nova no próximo acesso.`)) {
      try {
        await usuarioService.resetarSenha(user.id)
        alert('Senha resetada com sucesso! O usuário deverá definir uma nova senha ao entrar.')
        loadData()
      } catch (err) {
        alert(err.message || 'Erro ao resetar senha')
      }
    }
  }

  const statsUsuarios = [
    { icon: 'fa-users', bgClass: 'bg-blue-light', title: 'Total de Usuários', value: usuarios.length },
    { icon: 'fa-user-check', bgClass: 'bg-green-light', title: 'Usuários Ativos', value: usuarios.filter(u => u.ativo).length },
    { icon: 'fa-user-clock', bgClass: 'bg-yellow-light', title: '1º Acesso Pendente', value: usuarios.filter(u => u.primeiro_acesso).length },
  ]

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Carregando usuários...</p>
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
        {statsUsuarios.map((stat, index) => (
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
          <button type="button" className="btn btn-success" onClick={() => handleOpenModal('add')}>
            <FaPlus /> Novo Usuário
          </button>
        </div>
      </div>

      <div className="card table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome</th>
              <th>Login</th>
              <th>Perfil</th>
              <th>Status</th>
              <th>Acesso</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center' }}>Nenhum usuário encontrado</td>
              </tr>
            ) : (
              usuarios.map((user) => (
                <tr key={user.id} style={{ opacity: user.ativo ? 1 : 0.6 }}>
                  <td>{user.id}</td>
                  <td>{user.nome} {currentUser?.id === user.id && '(Você)'}</td>
                  <td>{user.login}</td>
                  <td>
                    <span style={{ textTransform: 'capitalize' }}>{user.perfil}</span>
                  </td>
                  <td>
                    <span className={`badge ${user.ativo ? 'badge-success' : 'badge-danger'}`}>
                      {user.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    {user.primeiro_acesso ? (
                      <span className="badge badge-warning">1º Login Pendente</span>
                    ) : (
                      <span className="badge badge-success" style={{ backgroundColor: '#3b82f6' }}>Senha Definida</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="action-btn action-btn-edit"
                        onClick={() => handleOpenModal('edit', user)}
                        title="Editar Perfil"
                      >
                        <FaEdit />
                      </button>
                      <button
                        type="button"
                        className="action-btn action-btn-view"
                        onClick={() => handleResetPassword(user)}
                        title="Redefinir Senha"
                      >
                        <FaKey />
                      </button>
                      {user.ativo ? (
                        <button
                          type="button"
                          className="action-btn action-btn-delete"
                          onClick={() => handleToggleActive(user)}
                          title="Desativar Usuário"
                          disabled={user.id === currentUser?.id}
                        >
                          <FaBan />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="action-btn action-btn-edit"
                          onClick={() => handleToggleActive(user)}
                          title="Reativar Usuário"
                        >
                          <FaCheck />
                        </button>
                      )}
                    </div>
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
              {modalMode === 'add' ? 'Adicionar Novo Usuário' : 'Editar Usuário'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nome Completo *</label>
                <input
                  type="text"
                  placeholder="Nome do usuário"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Login *</label>
                <input
                  type="text"
                  placeholder="Nome de login único"
                  value={formData.login}
                  onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                  required
                  disabled={modalMode === 'edit'}
                />
              </div>
              <div className="form-group">
                <label>Perfil de Acesso *</label>
                <select
                  className="filter-input-full"
                  value={formData.perfil}
                  onChange={(e) => setFormData({ ...formData, perfil: e.target.value })}
                  required
                  disabled={modalMode === 'edit' && selectedUser?.id === currentUser?.id}
                  style={modalMode === 'edit' && selectedUser?.id === currentUser?.id ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed' } : {}}
                >
                  <option value="vendas">Vendas</option>
                  <option value="financeiro">Financeiro</option>
                  <option value="gerente">Gerente</option>
                  <option value="admin">Administrador</option>
                  {selectedUser?.perfil === 'superadmin' && <option value="superadmin">Super Administrador</option>}
                </select>
                {modalMode === 'edit' && selectedUser?.id === currentUser?.id && (
                  <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                    * Por segurança, você não pode alterar seu próprio cargo.
                  </p>
                )}
              </div>
              
              {modalMode === 'add' && (
                <div style={{ marginBottom: '15px', color: '#666', fontSize: '0.9rem' }}>
                  Nota: Este usuário deverá definir sua própria senha no primeiro acesso.
                </div>
              )}

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

export default Usuarios
