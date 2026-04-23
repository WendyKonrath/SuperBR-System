import { useState, useEffect } from 'react'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js'
import { vendaService } from '../services/venda'
import { relatorioService } from '../services/relatorio'
import { movimentacaoService } from '../services/movimentacao'
import { FaFilePdf, FaSyncAlt, FaEye } from 'react-icons/fa'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement)

function Relatorios() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState({
    totalVendas: 0,
    totalPago: 0,
    produtosVendidos: 0,
    mediaVenda: 0
  })
  const [vendas, setVendas] = useState([])
  const [filters, setFilters] = useState({
    inicio: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    fim: new Date().toISOString().split('T')[0]
  })
  const [resumoVendas, setResumoVendas] = useState(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedVenda, setSelectedVenda] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      // Passa as datas dos filtros para o serviço
      const resumoData = await relatorioService.obterDadosVendas(filters.inicio, filters.fim)
      
      setResumoVendas(resumoData)
      setVendas(Array.isArray(resumoData.vendas) ? resumoData.vendas : [])

      const totalVendas = resumoData.total_produtos || 0 
      const totalRecebido = resumoData.receita_liquida || 0 
      const estoqueAtual = resumoData.total_itens_estoque || 0
      
      // Ticket médio baseado apenas em vendas concluídas
      const vendasConcluidas = resumoData.vendas?.filter(v => v.status === 'concluida') || []
      const mediaVenda = vendasConcluidas.length > 0 ? totalRecebido / vendasConcluidas.length : 0

      setStats({
        totalVendas,
        totalPago: totalRecebido,
        produtosVendidos: estoqueAtual,
        mediaVenda
      })
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError('Erro ao carregar dados de relatórios')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadVendas = async () => {
    try {
      await relatorioService.downloadPDFVendas(filters.inicio, filters.fim)
    } catch (err) {
      alert('Erro ao gerar PDF de vendas')
    }
  }

  const handleDownloadEstoque = async () => {
    try {
      await relatorioService.downloadPDFEstoque(filters.inicio, filters.fim)
    } catch (err) {
      alert('Erro ao gerar PDF de estoque')
    }
  }

  const handleOpenViewModal = (venda) => {
    setSelectedVenda(venda)
    setShowViewModal(true)
  }

  const handleCloseViewModal = () => {
    setShowViewModal(false)
    setSelectedVenda(null)
  }

  const handleDownloadComprovante = async (vendaId) => {
    try {
      await vendaService.gerarComprovante(vendaId)
    } catch (err) {
      alert('Erro ao baixar comprovante: ' + err.message)
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0)
  }

  const formatDate = (dateString) => {
    if (!dateString) return '---'
    const d = new Date(dateString)
    // Usar fuso local do navegador
    return d.toLocaleDateString('pt-BR')
  }

  const categoryData = {
    labels: (resumoVendas?.volumes || []).map(v => `${v.produto} [${v.categoria}]`),
    datasets: [{
      label: 'Volume por Produto',
      data: (resumoVendas?.volumes || []).map(v => v.quantidade),
      backgroundColor: '#0A1F44'
    }]
  }

  const paymentData = {
    labels: Object.keys(resumoVendas?.por_pagamento || {}).map(tipo => {
      switch (tipo) {
        case 'dinheiro': return 'Dinheiro'
        case 'pix': return 'Pix'
        case 'credito': return 'Crédito'
        case 'debito': return 'Débito'
        case 'sucata': return 'Sucata'
        default: return tipo
      }
    }),
    datasets: [{
      data: Object.values(resumoVendas?.por_pagamento || {}),
      backgroundColor: ['#28A745', '#0A1F44', '#FFC107', '#6c757d', '#17A2B8']
    }]
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Carregando relatórios...</p>
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

  const statsData = [
    { icon: 'fa-shopping-cart', bgClass: 'bg-blue-light', title: 'Total em Vendas (Bruto)', value: formatCurrency(stats.totalVendas) },
    { icon: 'fa-money-bill-trend-up', bgClass: 'bg-green-light', title: 'Faturamento Líquido', value: formatCurrency(stats.totalPago) },
    { icon: 'fa-boxes-packing', bgClass: 'bg-orange-light', title: 'Total em Estoque', value: `${stats.produtosVendidos} un` },
    { icon: 'fa-chart-line', bgClass: 'bg-purple-light', title: 'Ticket Médio (Líq)', value: formatCurrency(stats.mediaVenda) },
  ]

  const today = new Date().toISOString().split('T')[0]

  return (
    <>
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="card stat-card">
          <div className="stat-icon bg-green-light">
            <i className="fas fa-hand-holding-usd"></i>
          </div>
          <div className="stat-info">
            <h3>Receita Líquida</h3>
            <p>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalPago)}</p>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon bg-blue-light">
            <i className="fas fa-shopping-cart"></i>
          </div>
          <div className="stat-info">
            <h3>Itens Vendidos</h3>
            <p>{stats.totalVendas} un</p>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon bg-purple-light">
            <i className="fas fa-chart-line"></i>
          </div>
          <div className="stat-info">
            <h3>Ticket Médio</h3>
            <p>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.mediaVenda)}</p>
          </div>
        </div>
      </div>

      <div className="filters-bar">
        <div className="filter-group">
          <input
            type="date"
            className="filter-input"
            value={filters.inicio}
            max={today}
            onChange={(e) => setFilters({ ...filters, inicio: e.target.value })}
          />
          <span>até</span>
          <input
            type="date"
            className="filter-input"
            value={filters.fim}
            max={today}
            onChange={(e) => setFilters({ ...filters, fim: e.target.value })}
          />
          <button type="button" className="btn btn-primary" onClick={loadData}>
            <FaSyncAlt /> Atualizar
          </button>
          
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
            <button type="button" className="btn btn-success" onClick={handleDownloadVendas} title="Gerar PDF de Vendas">
              <FaFilePdf /> PDF Vendas
            </button>
            <button type="button" className="btn btn-danger" onClick={handleDownloadEstoque} title="Gerar PDF de Estoque e Movimentações">
              <FaFilePdf /> PDF Estoque
            </button>
          </div>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        {statsData.map((stat, index) => (
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

      <div className="dashboard-row">
        <div className="card">
          <h3>Faturamento por Produto (Qtd)</h3>
          <div className="chart-container">
            <Bar data={categoryData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>
        <div className="card">
          <h3>Meios de Recebimento</h3>
          <div className="chart-container">
            <Doughnut 
              data={paymentData} 
              options={{ 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: {
                  tooltip: {
                    callbacks: {
                      label: (context) => {
                        const label = context.label || '';
                        const value = context.parsed || 0;
                        return `${label}: ${formatCurrency(value)}`;
                      }
                    }
                  }
                }
              }} 
            />
          </div>
        </div>
      </div>

      <div className="card table-container report-table">
        <h3>Histórico Analítico de Vendas (Período)</h3>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Data</th>
              <th>Cliente</th>
              <th>Vendedor</th>
              <th>Valor Bruto</th>
              <th>Fat. Líquido</th>
              <th>Status</th>
              <th style={{ textAlign: 'center' }}>Ver</th>
            </tr>
          </thead>
          <tbody>
            {vendas.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center' }}>Nenhuma venda encontrada no período</td>
              </tr>
            ) : (
              vendas.map((venda) => {
                const fatLiquido = venda.status === 'concluida' ? (venda.valor_total - venda.troco_devolvido) : 0
                return (
                  <tr key={venda.id}>
                    <td style={{ color: '#64748b', fontWeight: 'bold' }}>#{venda.id}</td>
                    <td>{formatDate(venda.data)}</td>
                    <td>{venda.nome_cliente || 'Final de Consumidor'}</td>
                    <td style={{ fontWeight: '500' }}>{venda.usuario?.nome || 'Sistema'}</td>
                    <td style={{ color: '#64748b' }}>{formatCurrency(venda.valor_total)}</td>
                    <td style={{ color: '#16a34a', fontWeight: '600' }}>{formatCurrency(fatLiquido)}</td>
                    <td>
                      <span className={`badge ${venda.status === 'concluida' ? 'badge-success' : venda.status === 'reembolsada' || venda.status === 'reembolsado' || venda.status === 'devolvida' ? 'badge-danger' : 'badge-warning'}`}>
                        {venda.status === 'concluida' ? 'Concluída' : venda.status === 'reembolsada' || venda.status === 'reembolsado' || venda.status === 'devolvida' ? 'Reembolsada' : 'Pendente'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        className="action-btn action-btn-view"
                        onClick={() => handleOpenViewModal(venda)}
                        title="Ver Detalhes"
                      >
                        <FaEye />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {showViewModal && selectedVenda && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={handleCloseViewModal}>
          <div className="modal-card" style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Venda #{selectedVenda.id} - Detalhes</h3>
              <button 
                className="btn btn-success" 
                onClick={() => handleDownloadComprovante(selectedVenda.id)}
                style={{ fontSize: '0.85rem' }}
              >
                <FaFilePdf /> Baixar Comprovante
              </button>
            </div>

            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '20px' }}>
              <div className="card" style={{ padding: '10px' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Cliente</p>
                <p style={{ margin: 0, fontWeight: '600' }}>{selectedVenda.nome_cliente || 'Final de Consumidor'}</p>
                {selectedVenda.empresa && <p style={{ margin: 0, fontSize: '0.85rem' }}>Empresa: {selectedVenda.empresa}</p>}
              </div>
              <div className="card" style={{ padding: '10px' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Vendedor / Data</p>
                <p style={{ margin: 0, fontWeight: '600' }}>{selectedVenda.usuario?.nome || 'Sistema'}</p>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>{formatDate(selectedVenda.data)}</p>
              </div>
            </div>

            <h4 style={{ marginBottom: '10px' }}>Itens da Venda</h4>
            <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
              <table style={{ fontSize: '0.9rem' }}>
                <thead>
                  <tr>
                    <th>#ID Item</th>
                    <th>Qtd</th>
                    <th>Produto</th>
                    <th>Lote</th>
                    <th>Valor Unit.</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                   {selectedVenda.itens?.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ color: '#64748b', fontSize: '0.8rem' }}>#{item.item_estoque?.id}</td>
                      <td>{item.quantidade}</td>
                      <td>{item.item_estoque?.produto?.nome} {item.item_estoque?.produto?.categoria}</td>
                      <td>{item.item_estoque?.cod_lote}</td>
                      <td>{formatCurrency(item.valor_unitario)}</td>
                      <td>{formatCurrency(item.valor_unitario * item.quantidade)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedVenda.servicos && selectedVenda.servicos.length > 0 && (
              <>
                <h4 style={{ marginBottom: '10px' }}>Serviços Prestados</h4>
                <div className="table-container" style={{ maxHeight: '150px', overflowY: 'auto', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
                  <table style={{ fontSize: '0.9rem' }}>
                    <thead>
                      <tr>
                        <th>Serviço</th>
                        <th>Qtd</th>
                        <th>Valor Cobrado</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedVenda.servicos.map((s, idx) => (
                        <tr key={idx}>
                          <td>{s.servico?.nome}</td>
                          <td>{s.quantidade}</td>
                          <td>{formatCurrency(s.valor_cobrado)}</td>
                          <td>{formatCurrency(s.valor_cobrado * s.quantidade)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <div style={{ flex: 1 }}>
                 <h4>Pagamentos</h4>
                 <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '5px' }}>
                    {selectedVenda.pagamentos?.map((p, idx) => (
                      <span key={idx} className="badge" style={{ backgroundColor: '#f1f5f9', color: '#1e293b', border: '1px solid #e2e8f0' }}>
                        {p.tipo.toUpperCase()}: {formatCurrency(p.valor)}
                      </span>
                    ))}
                 </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, color: '#64748b' }}>Valor Total da Venda</p>
                <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>{formatCurrency(selectedVenda.valor_total)}</h3>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '25px' }}>
              <button className="btn btn-primary" onClick={handleCloseViewModal}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Relatorios