import { useState, useEffect } from 'react'
import { FaSave, FaCogs } from 'react-icons/fa'
import { configuracaoService } from '../services/configuracao'
import { useAuth } from '../context/AuthContext'

function Configuracoes() {
  const { usuario } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  
  const [formData, setFormData] = useState({
    estoqueMinimo: 5,
    precoSucata: 3.0
  })

  useEffect(() => {
    loadConfiguracoes()
  }, [])

  const loadConfiguracoes = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await configuracaoService.obterConfiguracoes()
      setFormData({
        estoqueMinimo: data.alerta_estoque_baixo || 5,
        precoSucata: data.preco_sucata_kg || 3.0
      })
    } catch (err) {
      console.error('Erro ao carregar configurações:', err)
      setError('Erro ao carregar parâmetros do sistema')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await configuracaoService.atualizarConfiguracoes(formData)
      alert('Configurações aplicadas e espelhadas em todo o sistema com sucesso!')
      loadConfiguracoes()
    } catch (err) {
      console.error('Erro ao salvar:', err)
      alert(err.response?.data?.error || 'Erro ao modificar configurações do sistema.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Acessando painel de controle...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-container">
        <p>{error}</p>
        <button onClick={loadConfiguracoes} className="btn btn-primary">Tentar novamente</button>
      </div>
    )
  }

  return (
    <>
      <div className="card" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
        <div className="header-actions" style={{ borderBottom: '1px solid #eee', paddingBottom: '1rem', marginBottom: '2rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><FaCogs /> Parâmetros Globais do Sistema</h2>
          <p style={{ color: '#666', marginTop: '0.5rem' }}>Essas configurações afetam o funcionamento automático de todo o fluxo operacional da Super BR.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Alerta de Estoque Baixo (Unidades) *</label>
            <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '10px' }}>
              Ao despachar ou vender baterias, o sistema irá notificar automaticamente caso a quantidade total daquele produto fique igual ou abaixo desse valor.
            </p>
            <input
              type="number"
              min="0"
              style={{ padding: '0.75rem', fontSize: '1rem', width: '100%', maxWidth: '200px' }}
              value={formData.estoqueMinimo}
              onChange={(e) => setFormData({ ...formData, estoqueMinimo: e.target.value })}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Preço Global da Sucata (R$ / Quilo) *</label>
            <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '10px' }}>
              Todo registro de Sucata novo assumirá esse valor. Quando você altera esse campo, TODAS as sucatas cadastradas no sistema terão o Valor Total recalculado instantaneamente.
            </p>
            <input
              type="number"
              step="0.01"
              min="0"
              style={{ padding: '0.75rem', fontSize: '1rem', width: '100%', maxWidth: '200px' }}
              value={formData.precoSucata}
              onChange={(e) => setFormData({ ...formData, precoSucata: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #eee' }}>
            <button 
              type="submit" 
              className="btn btn-success" 
              style={{ padding: '0.75rem 2rem', fontSize: '1.1rem' }}
              disabled={saving}
            >
              <FaSave /> {saving ? 'Aplicando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

export default Configuracoes
