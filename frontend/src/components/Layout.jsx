import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  FaChartLine, FaBoxes, FaRecycle, FaShoppingCart,
  FaFileInvoiceDollar, FaBell, FaSignOutAlt,
  FaUsers, FaBoxOpen, FaExchangeAlt, FaCogs
} from 'react-icons/fa'
import { useAuth } from '../context/AuthContext'
import { notificacaoService } from '../services/notificacao'

function Layout({ children }) {
  const navigate = useNavigate()
  const { usuario, logout } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!usuario) return;

    const podeVerNotificacoes = usuario.perfil === 'admin' || usuario.perfil === 'gerente' || usuario.perfil === 'superadmin'
    
    if (!podeVerNotificacoes) return;

    const fetchUnread = async () => {
      try {
        const data = await notificacaoService.listar(true)
        setUnreadCount(Array.isArray(data) ? data.length : 0)
      } catch (e) {
        console.error('Erro ao buscar notificações não lidas')
      }
    }

    fetchUnread()
    const interval = setInterval(fetchUnread, 30000) // Atualiza a cada 30s
    return () => clearInterval(interval)
  }, [usuario])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const hasAccess = (allowedProfiles) => {
    if (!usuario) return false
    if (usuario.perfil === 'superadmin') return true
    return allowedProfiles.includes(usuario.perfil)
  }

  const getProfileLabel = (perfil) => {
    switch (perfil) {
      case 'admin': return 'Administrador'
      case 'gerente': return 'Gerente'
      case 'financeiro': return 'Financeiro'
      case 'vendas': return 'Vendas'
      default: return perfil
    }
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src="/assets/logo.jpg" alt="Baterias SuperBR" />
        </div>
        <ul className="sidebar-menu">
          {hasAccess(['admin', 'gerente', 'financeiro']) && (
            <li>
              <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
                <FaChartLine /> Dashboard
              </NavLink>
            </li>
          )}
          <li>
            <NavLink to="/estoque" className={({ isActive }) => isActive ? 'active' : ''}>
              <FaBoxes /> Estoque
            </NavLink>
          </li>
          <li>
            <NavLink to="/produtos" className={({ isActive }) => isActive ? 'active' : ''}>
              <FaBoxOpen /> Produtos
            </NavLink>
          </li>
          {hasAccess(['admin', 'gerente', 'financeiro', 'vendas']) && (
            <li>
              <NavLink to="/sucata" className={({ isActive }) => isActive ? 'active' : ''}>
                <FaRecycle /> Sucata
              </NavLink>
            </li>
          )}
          <li>
            <NavLink to="/vendas" className={({ isActive }) => isActive ? 'active' : ''}>
              <FaShoppingCart /> Vendas
            </NavLink>
          </li>
          {hasAccess(['admin', 'gerente', 'financeiro']) && (
            <li>
              <NavLink to="/relatorios" className={({ isActive }) => isActive ? 'active' : ''}>
                <FaFileInvoiceDollar /> Relatórios
              </NavLink>
            </li>
          )}
          {hasAccess(['admin', 'gerente', 'financeiro']) && (
            <li>
              <NavLink to="/movimentacoes" className={({ isActive }) => isActive ? 'active' : ''}>
                <FaExchangeAlt /> Movimentações
              </NavLink>
            </li>
          )}
          {hasAccess(['admin', 'gerente']) && (
            <li>
              <NavLink to="/notificacoes" className={({ isActive }) => isActive ? 'active' : ''}>
                <FaBell /> Notificações
                {unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>}
              </NavLink>
            </li>
          )}
          {hasAccess(['admin']) && (
            <>
              <li>
                <NavLink to="/usuarios" className={({ isActive }) => isActive ? 'active' : ''}>
                  <FaUsers /> Usuários
                </NavLink>
              </li>
              <li>
                <NavLink to="/configuracoes" className={({ isActive }) => isActive ? 'active' : ''}>
                  <FaCogs /> Configurações
                </NavLink>
              </li>
            </>
          )}
        </ul>
      </aside>

      <main className="main-content">
        <header className="header">
          <div className="page-title">
            <h2>Baterias SuperBR</h2>
          </div>
          <div className="header-user">
            <span>{usuario?.nome || 'Usuário'} ({getProfileLabel(usuario?.perfil)})</span>
            <button onClick={handleLogout} className="btn btn-primary btn-logout">
              <FaSignOutAlt /> Sair
            </button>
          </div>
        </header>

        <div className="content-body">
          {children}
        </div>
      </main>
    </div>
  )
}

export default Layout