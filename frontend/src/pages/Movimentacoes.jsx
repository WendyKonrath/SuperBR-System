import { useState, useEffect } from 'react'
import { movimentacaoService, movimentacaoSucataService } from '../services/movimentacao'
import { produtoService } from '../services/produto'
import { usuarioService } from '../services/usuario'
import { sucataService } from '../services/sucata'

function Movimentacoes() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [movimentacoes, setMovimentacoes] = useState([])
  const [produtos, setProdutos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [sucatas, setSucatas] = useState([])
  const [tab, setTab] = useState('baterias') // baterias, sucata
  const [filtros, setFiltros] = useState({
    tipo: '',
    produto_id: '',
    usuario_id: '',
    item_id: '',
    sucata_id: '',
    peso_min: '',
    peso_max: '',
    inicio: '',
    fim: ''
  })

  useEffect(() => {
    loadAuxData()
  }, [])

  useEffect(() => {
    loadData()
  }, [tab, filtros])

  const loadAuxData = async () => {
    try {
      const [prods, usrs, scps] = await Promise.all([
        produtoService.listar(),
        usuarioService.listar(),
        sucataService.listar()
      ])
      setProdutos(prods || [])
      setUsuarios(usrs || [])
      setSucatas(scps || [])
    } catch (err) {
      console.error('Erro ao carregar dados auxiliares:', err)
    }
  }

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      let data = []
      const params = { ...filtros }

      // Limpa campos vazios
      Object.keys(params).forEach(key => {
        if (!params[key]) delete params[key]
      })

      if (tab === 'baterias') {
        data = await movimentacaoService.listar(params)
      } else {
        data = await movimentacaoSucataService.listar(params)
      }
      
      setMovimentacoes(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError('Erro ao carregar as movimentações do histórico.')
    } finally {
      setLoading(false)
    }
  }

  const limparFiltros = () => {
    setFiltros({
      tipo: '',
      produto_id: '',
      usuario_id: '',
      item_id: '',
      sucata_id: '',
      peso_min: '',
      peso_max: '',
      inicio: '',
      fim: ''
    })
  }

  if (loading && movimentacoes.length === 0) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Carregando histórico...</p>
      </div>
    )
  }

  return (
    <>
      <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #f1f5f9', paddingBottom: '15px' }}>
          <div className="filter-group" style={{ display: 'flex', gap: '8px' }}>
            <button 
              className={`btn ${tab === 'baterias' ? 'btn-primary' : 'btn-cancel'}`}
              onClick={() => { setTab('baterias'); limparFiltros(); }}
              style={{ padding: '8px 16px', fontSize: '0.9rem' }}
            >
              Baterias Novas
            </button>
            <button 
              className={`btn ${tab === 'sucata' ? 'btn-primary' : 'btn-cancel'}`}
              onClick={() => { setTab('sucata'); limparFiltros(); }}
              style={{ padding: '8px 16px', fontSize: '0.9rem' }}
            >
              Sucatas
            </button>
          </div>
          <button className="btn btn-cancel" onClick={limparFiltros} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
            Limpar Filtros
          </button>
        </div>

        <div className="filters-bar" style={{ 
          display: 'flex', 
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'flex-end',
          padding: '0',
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
          marginBottom: '0'
        }}>
          <div className="filter-item" style={{ flex: '1 1 150px' }}>
            <label style={{ fontSize: '0.7rem', fontWeight: '800', display: 'block', marginBottom: '4px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Operação
            </label>
            <select 
              className="filter-input-full"
              value={filtros.tipo}
              onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}
              style={{ height: '38px', fontSize: '0.9rem' }}
            >
              <option value="">Todas</option>
              {tab === 'baterias' ? (
                <>
                  <option value="entrada">ENTRADA</option>
                  <option value="vendido">VENDIDO</option>
                  <option value="reserva">RESERVA</option>
                  <option value="reembolso">REEMBOLSO / DEVOLUÇÃO</option>
                  <option value="disponivel">DISPONÍVEL</option>
                  <option value="emprestado">EMPRESTADO</option>
                  <option value="indisponivel">AJUSTE / BAIXA</option>
                  <option value="fora_estoque">FORA DE ESTOQUE</option>
                </>
              ) : (
                <>
                  <option value="entrada_sucata">ENTRADA SUCATA</option>
                  <option value="saida_sucata">SAÍDA SUCATA</option>
                </>
              )}
            </select>
          </div>

          {tab === 'baterias' ? (
            <>
              <div className="filter-item" style={{ flex: '1 1 180px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: '800', display: 'block', marginBottom: '4px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                   Produto
                </label>
                <select 
                  className="filter-input-full"
                  value={filtros.produto_id}
                  onChange={(e) => setFiltros({ ...filtros, produto_id: e.target.value })}
                  style={{ height: '38px', fontSize: '0.9rem' }}
                >
                  <option value="">Todos os Modelos</option>
                  {produtos.map(p => (
                    <option key={p.id} value={p.id}>{p.nome} [{p.categoria}]</option>
                  ))}
                </select>
              </div>
              <div className="filter-item" style={{ flex: '0 1 120px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: '800', display: 'block', marginBottom: '4px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ID do Item
                </label>
                <input 
                  type="text"
                  placeholder="Ex: #123"
                  className="filter-input-full"
                  value={filtros.item_id}
                  onChange={(e) => setFiltros({ ...filtros, item_id: e.target.value })}
                  style={{ height: '38px', fontSize: '0.9rem' }}
                />
              </div>
            </>
          ) : (
            <>
              <div className="filter-item" style={{ flex: '1 1 200px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: '800', display: 'block', marginBottom: '4px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                   Filtro Bateria (Sucata)
                </label>
                <select 
                  className="filter-input-full"
                  value={filtros.sucata_id}
                  onChange={(e) => setFiltros({ ...filtros, sucata_id: e.target.value })}
                  style={{ height: '38px', fontSize: '0.9rem' }}
                >
                  <option value="">Todas as Sucatas</option>
                  {sucatas.map(s => (
                    <option key={s.id} value={s.id}>{s.produto?.nome || 'Sucata'} [{s.produto?.categoria || '--'}]</option>
                  ))}
                </select>
              </div>
              <div className="filter-item">
                <label style={{ fontSize: '0.7rem', fontWeight: '800', display: 'block', marginBottom: '4px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Faixa de Peso (kg)
                </label>
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center', backgroundColor: '#f8fafc', padding: '2px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', height: '38px' }}>
                  <input
                    type="number"
                    step="0.1"
                    className="filter-input"
                    style={{ width: '50px', border: 'none', background: 'transparent', padding: '0', height: '100%', boxShadow: 'none' }}
                    placeholder="Min"
                    value={filtros.peso_min}
                    onChange={(e) => setFiltros({ ...filtros, peso_min: e.target.value })}
                  />
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <input
                    type="number"
                    step="0.1"
                    className="filter-input"
                    style={{ width: '50px', border: 'none', background: 'transparent', padding: '0', height: '100%', boxShadow: 'none' }}
                    placeholder="Max"
                    value={filtros.peso_max}
                    onChange={(e) => setFiltros({ ...filtros, peso_max: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}

          <div className="filter-item">
            <label style={{ fontSize: '0.7rem', fontWeight: '800', display: 'block', marginBottom: '6px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Usuário
            </label>
            <select 
              className="filter-input-full"
              value={filtros.usuario_id}
              onChange={(e) => setFiltros({ ...filtros, usuario_id: e.target.value })}
              style={{ height: '38px', fontSize: '0.9rem' }}
            >
              <option value="">Todos os Usuários</option>
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </div>

          <div className="filter-item" style={{ flex: '1 1 150px' }}>
            <label style={{ fontSize: '0.7rem', fontWeight: '800', display: 'block', marginBottom: '4px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Usuário
            </label>
            <input 
              type="date"
              className="filter-input-full"
              value={filtros.inicio}
              onChange={(e) => setFiltros({ ...filtros, inicio: e.target.value })}
              style={{ height: '38px', fontSize: '0.9rem' }}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="filter-item">
            <label style={{ fontSize: '0.7rem', fontWeight: '800', display: 'block', marginBottom: '6px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Até (Data)
            </label>
            <input 
              type="date"
              className="filter-input-full"
              value={filtros.fim}
              onChange={(e) => setFiltros({ ...filtros, fim: e.target.value })}
              style={{ height: '38px', fontSize: '0.9rem' }}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
      </div>

      {error ? (
        <div className="error-container">
          <p>{error}</p>
          <button onClick={loadData} className="btn btn-primary">Tentar novamente</button>
        </div>
      ) : (
        <div className="card table-container">
          <table className="table-hover">
            <thead>
              <tr>
                {tab === 'baterias' ? (
                  <>
                    <th style={{ width: '80px' }}>ID Item</th>
                    <th>Data / Hora</th>
                    <th>Operação</th>
                    <th>Motivo / Origem</th>
                    <th>Produto / Lote</th>
                    <th>Usuário</th>
                  </>
                ) : (
                  <>
                    <th style={{ width: '80px' }}>ID Lote</th>
                    <th>Data / Hora</th>
                    <th>Operação</th>
                    <th>Produto / Categoria (Sucata)</th>
                    <th>Peso (kg)</th>
                    <th>Usuário</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {movimentacoes.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    Nenhuma movimentação encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                movimentacoes.map((mov, index) => (
                  <tr key={mov.id || index}>
                    <td style={{ fontWeight: '800', color: '#1e293b', fontSize: '1rem' }}>
                      {tab === 'baterias' ? (
                        <span style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                          #{mov.item_id || mov.item?.item_id || '--'}
                        </span>
                      ) : (
                        <span style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                          #{mov.sucata_id || '--'}
                        </span>
                      )}
                    </td>
                    <td>{new Date(mov.data || mov.data_movimentacao || mov.created_at).toLocaleString('pt-BR')}</td>
                    <td>
                      <span className={`badge ${
                        (mov.tipo?.toLowerCase() === 'entrada' || mov.tipo?.toLowerCase() === 'disponivel' || mov.tipo?.toLowerCase() === 'entrada_sucata') ? 'badge-success' : 
                        (mov.tipo?.toLowerCase() === 'saida' || mov.tipo?.toLowerCase() === 'indisponivel' || mov.tipo?.toLowerCase() === 'vendido' || mov.tipo?.toLowerCase() === 'saida_sucata' || mov.tipo?.toLowerCase() === 'fora_estoque') ? 'badge-danger' : 
                        (mov.tipo?.toLowerCase() === 'reserva' || mov.tipo?.toLowerCase() === 'emprestado' || mov.tipo?.toLowerCase() === 'emprestimo') ? 'badge-warning' :
                        (mov.tipo?.toLowerCase() === 'reembolso' || mov.tipo?.toLowerCase() === 'reembolsado') ? 'badge-reembolsado' : 'badge-info'
                      }`}>
                        {mov.tipo?.toLowerCase() === 'fora_estoque' ? 'FORA ESTOQUE' : mov.tipo?.replace('_SUCATA', '').toUpperCase()}
                      </span>
                    </td>
                    {tab === 'baterias' ? (
                      <>
                        <td>
                          <span style={{ 
                            fontWeight: '600', 
                            color: (mov.motivo?.includes('Venda') || mov.motivo?.includes('Reserva')) ? '#7c3aed' : 
                                   (mov.motivo?.includes('Reembolso') || mov.motivo?.includes('Devolução')) ? '#ef4444' : 
                                   mov.motivo?.includes('Manual') ? '#64748b' : '#1e293b' 
                          }}>
                            {mov.motivo || 'Entrada Inicial'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                              {mov.item?.nome_produto || '--'} 
                              <span style={{ color: '#64748b', marginLeft: '5px' }}>[{mov.item?.categoria || '--'}]</span>
                            </span>
                            <small style={{ color: '#64748b' }}>Lote: {mov.item?.cod_lote || '--'}</small>
                          </div>
                        </td>
                        <td style={{ fontWeight: '500', color: '#475569' }}>{mov.usuario?.nome || '--'}</td>
                      </>
                    ) : (
                      <>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                              {mov.sucata?.nome || '--'} 
                              <span style={{ color: '#64748b', marginLeft: '5px' }}>[{mov.sucata?.categoria || '--'}]</span>
                            </span>
                          </div>
                        </td>
                        <td style={{ fontWeight: 'bold', color: '#1e293b' }}>{mov.peso?.toFixed(1) || '0.0'} kg</td>
                        <td style={{ fontWeight: '500', color: '#475569' }}>{mov.usuario?.nome || '--'}</td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export default Movimentacoes
