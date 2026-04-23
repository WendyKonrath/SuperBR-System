import { useState, useEffect } from 'react'
import { Line, Pie } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { dashboardService } from '../services/dashboard'
import { notificacaoService } from '../services/notificacao'
import { useAuth } from '../context/AuthContext'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend)

function Dashboard() {
  const { usuario } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState({
    totalEstoque: 0,
    valorTotal: 0,
    estoqueBaixo: 0,
    vendasDia: 0,
  })
  const [alertas, setAlertas] = useState([])
  const [chartData, setChartData] = useState(null)
  const [pieData, setPieData] = useState(null)

  useEffect(() => {
    if (usuario) {
      loadDashboardData()
    }
  }, [usuario])

  const loadDashboardData = async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await dashboardService.obterEstatisticas();
      
      let notificacoesData = [];
      const podeVerNotificacoes = usuario?.perfil === 'admin' || usuario?.perfil === 'gerente' || usuario?.perfil === 'superadmin'

      if (podeVerNotificacoes) {
        try {
          notificacoesData = await notificacaoService.listar()
        } catch (err) {
          console.warn('Falha ao carregar notificações (segurança):', err)
        }
      }

      // 1. Indicadores (Cards)
      setStats({
        totalEstoque: data?.metricas_cards?.total_estoque || 0,
        valorTotal: data?.metricas_cards?.valor_total || 0,
        estoqueBaixo: data?.metricas_cards?.estoque_baixo || 0,
        vendasDia: data?.metricas_cards?.vendas_dia || 0,
      })

      // 2. Alertas Críticos (Mistura notificações do sistema com alertas gerados dinamicamente)
      const alertasSistema = (notificacoesData || [])
        .filter(n => n.tipo === 'critico')
        .map(n => ({
          title: n.titulo || 'Prioridade',
          desc: n.mensagem || '',
          badge: 'Sistema',
          badgeClass: 'badge-danger',
        }))

      const alertasBackend = (data?.alertas || []).map(a => ({
        title: a.nivel === 'critico' ? 'Atenção Crítica' : 'Aviso de Estoque',
        desc: a.mensagem,
        badge: a.nivel === 'critico' ? 'Crítico' : 'Baixo',
        badgeClass: a.nivel === 'critico' ? 'badge-danger' : 'badge-warning',
      }))

      setAlertas([...alertasSistema, ...alertasBackend].slice(0, 8))

      // 3. Gráfico de Área (Fluxo Financeiro - Big Company Style)
      const fluxoFin = data?.fluxo_financeiro || []
      setChartData({
        labels: fluxoFin.map(f => f.mes),
        datasets: [
          {
            label: 'Receita de Vendas (R$)',
            data: fluxoFin.map(f => f.receita_vendas),
            borderColor: '#10B981', // Emerald Green
            backgroundColor: 'rgba(16, 185, 129, 0.15)', // Light Green Fill
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: '#10B981',
          },
          {
            label: 'Investimento em Estoque (R$)',
            data: fluxoFin.map(f => f.custo_reposicao),
            borderColor: '#334155', // Slate Navy
            backgroundColor: 'rgba(51, 65, 85, 0.1)', // Light Navy Fill
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: '#334155',
          },
        ],
      })

      // 4. Gráfico de Pizza (Distribuição por Produto)
      const distEstoque = data?.distribuicao_estoque || []
      const cores = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#6366F1'];
      setPieData({
        labels: distEstoque.map(d => d.label),
        datasets: [{
          data: distEstoque.map(d => d.quantidade),
          backgroundColor: distEstoque.map((_, i) => cores[i % cores.length]),
          borderWidth: 1,
        }]
      })

    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err)
      setError('Erro ao carregar dados. Verifique se o back-end está em execução.')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Carregando dashboard...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-container">
        <p>{error}</p>
        <button onClick={loadDashboardData} className="btn btn-primary">
          Tentar novamente
        </button>
      </div>
    )
  }

  const statsData = [
    { icon: 'fa-battery-three-quarters', bgClass: 'bg-blue-light', title: 'Disponível em Estoque', value: stats.totalEstoque.toLocaleString('pt-BR') },
    { icon: 'fa-dollar-sign', bgClass: 'bg-green-light', title: 'Investimento em Estoque', value: formatCurrency(stats.valorTotal) },
    { icon: 'fa-exclamation-triangle', bgClass: 'bg-yellow-light', title: 'Estoque Baixo', value: `${stats.estoqueBaixo} itens` },
    { icon: 'fa-shopping-bag', bgClass: 'bg-purple-light', title: 'Vendas do Dia', value: stats.vendasDia },
  ]

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          boxWidth: 12,
          padding: 20,
          usePointStyle: true,
          font: { size: 13, weight: '600' }
        }
      },
      tooltip: {
        backgroundColor: '#1E293B',
        padding: 12,
        titleFont: { size: 14, weight: '700' },
        bodyFont: { size: 13 },
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        displayColors: true,
        cornerRadius: 8,
        callbacks: {
          label: (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`
        }
      }
    },
    scales: {
      y: {
        ticks: {
          callback: (value) => formatCurrency(value)
        }
      }
    }
  }

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right' }
    }
  }

  return (
    <>
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
        <div className="card" style={{ flex: '2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0 }}>Saúde Financeira (Vendas vs Investimento)</h3>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Últimos 6 meses</span>
          </div>
          <div className="chart-container" style={{ height: '350px' }}>
            {chartData && <Line data={chartData} options={lineOptions} />}
          </div>
        </div>

        <div className="card" style={{ flex: '1' }}>
          <h3>Distribuição por Produto</h3>
          <div className="chart-container" style={{ height: '300px' }}>
            {pieData && <Pie data={pieData} options={pieOptions} />}
          </div>
        </div>
      </div>

      <div className="dashboard-row" style={{ marginTop: '20px' }}>
        <div className="card" style={{ flex: '1' }}>
          <h3>Prioridades e Alertas Críticos</h3>
          <div className="alert-list">
            {alertas.length > 0 ? (
              alertas.map((alert, index) => (
                <div key={index} className="alert-item">
                  <div style={{ flex: '1' }}>
                    <p style={{ margin: '0 0 4px 0', fontSize: '0.95rem' }}><strong>{alert.title}</strong></p>
                    <small style={{ color: '#64748b' }}>{alert.desc}</small>
                  </div>
                  <span className={`badge ${alert.badgeClass}`} style={{ alignSelf: 'center' }}>{alert.badge}</span>
                </div>
              ))
            ) : (
              <p className="empty-message">Nenhum alerta crítico no momento</p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default Dashboard