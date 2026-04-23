import { useState, useEffect } from 'react'
import { FaExclamationTriangle, FaTruckLoading, FaShoppingCart } from 'react-icons/fa'
import { notificacaoService } from '../services/notificacao'
import { useAuth } from '../context/AuthContext'

function Notificacoes() {
  const { usuario } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notificacoes, setNotificacoes] = useState([])
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await notificacaoService.listar()
      setNotificacoes(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Erro ao carregar notificações:', err)
      setError('Erro ao carregar notificações')
    } finally {
      setLoading(false)
    }
  }

  const handleMarcarComoLida = async (id) => {
    try {
      await notificacaoService.marcarComoLida(id)
      loadData()
    } catch (err) {
      console.error('Erro ao marcar como lida:', err)
    }
  }

  const handleMarcarTodasComoLidas = async () => {
    setMarkingAll(true)
    try {
      await notificacaoService.marcarTodasComoLidas()
      loadData()
    } catch (err) {
      console.error('Erro ao marcar todas como lidas:', err)
    } finally {
      setMarkingAll(false)
    }
  }

  const getIconComponent = (icone) => {
    switch (icone) {
      case 'FaExclamationTriangle':
      case 'warning':
        return FaExclamationTriangle
      case 'FaTruckLoading':
      case 'truck':
        return FaTruckLoading
      case 'FaShoppingCart':
      case 'cart':
        return FaShoppingCart
      default:
        return FaExclamationTriangle
    }
  }

  const getIconClass = (tipo) => {
    switch (tipo) {
      case 'critico':
        return 'bg-yellow-light'
      case 'info':
        return 'bg-blue-light'
      case 'success':
        return 'bg-green-light'
      default:
        return 'bg-blue-light'
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Carregando notificações...</p>
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
      <div className="card">
        <div className="notifications-header">
          <h3>Suas Mensagens e Alertas</h3>
          <button
            type="button"
            className="btn btn-primary btn-mark-all"
            onClick={handleMarcarTodasComoLidas}
            disabled={markingAll}
          >
            <i className="fas fa-check-double"></i>
            {markingAll ? 'Marcando...' : 'Marcar todas como lidas'}
          </button>
        </div>

        <div className="notification-list">
          {notificacoes.length === 0 ? (
            <p className="empty-message">Nenhuma notificação no momento</p>
          ) : (
            notificacoes.map((notification) => {
              const IconComponent = getIconComponent(notification.icone)
              return (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.lida ? 'unread' : ''}`}
                >
                  <div className={`stat-icon ${getIconClass(notification.tipo)} notification-icon`}>
                    <IconComponent />
                  </div>
                  <div className="notification-body">
                    <p><strong>{notification.titulo || notification.mensagem}</strong></p>
                    {notification.mensagem && notification.titulo && (
                      <p className="notification-text">{notification.mensagem}</p>
                    )}
                    <small className="notification-meta">
                      {notification.criado_em
                        ? new Date(notification.criado_em).toLocaleString('pt-BR')
                        : '---'}
                    </small>
                  </div>
                  {!notification.lida && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleMarcarComoLida(notification.id)}
                    >
                      Marcar como lida
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}

export default Notificacoes