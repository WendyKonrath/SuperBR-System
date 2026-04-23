import { useState, useEffect } from 'react'
import { FaPlus, FaTrash, FaEye, FaCheck, FaTimes, FaFilePdf, FaEdit } from 'react-icons/fa'
import { vendaService } from '../services/venda'
import { produtoService } from '../services/produto'
import { estoqueService } from '../services/estoque'
import { servicoService } from '../services/servico'

import { useAuth } from '../context/AuthContext'

function Vendas() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [vendas, setVendas] = useState([])
  const [produtos, setProdutos] = useState([])
  const [estoques, setEstoques] = useState([])
  const [itensEstoque, setItensEstoque] = useState([])
  const [servicosDisponiveis, setServicosDisponiveis] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showListModal, setShowListModal] = useState(false)
  const [showServicoModal, setShowServicoModal] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [search, setSearch] = useState('')
  const [currentVenda, setCurrentVenda] = useState(null)
  const [editingVendaId, setEditingVendaId] = useState(null)
  const [formData, setFormData] = useState({
    cliente: '',
    documento: '',
    telefone: '',
    observacoes: '',
    data: new Date().toISOString().split('T')[0],
    tipoPreco: 'varejo',
    dinheiro: '',
    pix: '',
    credito: '',
    debito: '',
    sucata: '',
    troco_devolvido: '0,00'
  })
  const [itens, setItens] = useState([])
  const [servicosVenda, setServicosVenda] = useState([])
  const { usuario } = useAuth()

  // Comentado para evitar que o troco seja preenchido automaticamente, conforme pedido do usuário.
  // useEffect(() => {
  //   const total = itens.reduce((acc, it) => acc + (it.quantidade * it.valor_unitario), 0);
  //   const pago = Object.entries(formData)
  //     .filter(([k]) => ['dinheiro', 'pix', 'credito', 'debito', 'sucata'].includes(k))
  //     .reduce((acc, [_, v]) => acc + parseCurrency(v), 0);
  //   
  //   const trocoSugestivo = Math.max(0, pago - total);
  //   setFormData(prev => ({
  //     ...prev,
  //     troco_devolvido: formatCurrency(trocoSugestivo).replace('R$', '').trim()
  //   }));
  // }, [itens]);
  const [submitting, setSubmitting] = useState(false)
  const [editingObs, setEditingObs] = useState(false)
  const [tempObs, setTempObs] = useState('')
  const [filters, setFilters] = useState({
    status: '',
    dataDe: '',
    dataAte: '',
    busca: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [vendasData, produtosData, estoquesData, itensEstoqueData, servicosData] = await Promise.all([
        vendaService.listar(),
        produtoService.listar(),
        estoqueService.listarEstoque(),
        estoqueService.listarItens(),
        servicoService.listar()
      ])
      setVendas(Array.isArray(vendasData) ? vendasData : [])
      setProdutos(Array.isArray(produtosData) ? produtosData : [])
      setEstoques(Array.isArray(estoquesData) ? estoquesData : [])
      setItensEstoque(Array.isArray(itensEstoqueData) ? itensEstoqueData : [])
      setServicosDisponiveis(Array.isArray(servicosData?.data) ? servicosData.data : Array.isArray(servicosData) ? servicosData : [])
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const parseCurrency = (value) => {
    if (!value) return 0
    return parseFloat(value.toString().replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0)
  }

  const maskCPF_CNPJ = (value) => {
    let v = (value || '').replace(/\D/g, "")
    if (v.length <= 11) {
      v = v.replace(/(\d{3})(\d)/, "$1.$2")
      v = v.replace(/(\d{3})(\d)/, "$1.$2")
      v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2")
    } else {
      v = v.substring(0, 14)
      v = v.replace(/^(\d{2})(\d)/, "$1.$2")
      v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      v = v.replace(/\.(\d{3})(\d)/, ".$1/$2")
      v = v.replace(/(\d{4})(\d{1,2})$/, "$1-$2")
    }
    return v
  }

  const calcularTotal = () => {
    const totalItens = itens.reduce((acc, item) => acc + (item.quantidade * item.valor_unitario), 0)
    const totalServicos = servicosVenda.reduce((acc, serv) => acc + (serv.quantidade * serv.valor_cobrado), 0)
    return totalItens + totalServicos
  }

  const handleOpenProductModal = (product) => {
    const est = estoques.find(e => e.produto_id === product.id)
    const maxQty = est ? est.qtd_atual : 0
    if (maxQty === 0) {
      alert(`O produto ${product.nome} está sem estoque disponível!`);
      return;
    }
    setSelectedProduct({ ...product, maxStock: maxQty })
    setQuantity(1)
    setShowProductModal(true)
  }

  const handleConfirmProduct = () => {
    if (!selectedProduct) return

    const valorUnitario = formData.tipoPreco === 'atacado'
      ? selectedProduct.valor_atacado
      : selectedProduct.valor_varejo

    const existingIndex = itens.findIndex(i => i.produto_id === selectedProduct.id)

    if (existingIndex >= 0) {
      const updatedItens = [...itens]
      updatedItens[existingIndex].quantidade += quantity
      setItens(updatedItens)
    } else {
      setItens([...itens, {
        id: Date.now(),
        produto_id: selectedProduct.id,
        nome: selectedProduct.nome,
        quantidade,
        valor_unitario: valorUnitario,
        tipo_preco: formData.tipoPreco
      }])
    }

    setShowProductModal(false)
    setSelectedProduct(null)
  }


  const handleAddDirectToCart = (product) => {
    const est = estoques.find(e => e.produto_id === product.id)
    const qtdNoEstoque = est ? est.qtd_atual : 0
    const jaNoCarrinho = itens.find(i => i.produto_id === product.id)?.quantidade || 0
    const maxQty = qtdNoEstoque

    if (qtdNoEstoque === 0 && jaNoCarrinho === 0) return;
    if (jaNoCarrinho >= qtdNoEstoque) {
      alert('Limite máximo de estoque disponível atingido para esse produto.');
      return;
    }

    const valorUnitario = formData.tipoPreco === 'atacado'
      ? product.valor_atacado
      : product.valor_varejo

    const existingIndex = itens.findIndex(i => i.produto_id === product.id)
    if (existingIndex >= 0) {
      const updatedItens = [...itens]
      updatedItens[existingIndex] = {
        ...updatedItens[existingIndex],
        quantidade: updatedItens[existingIndex].quantidade + 1,
        maxStock: maxQty
      }
      setItens(updatedItens)
    } else {
      setItens([...itens, {
        id: Date.now(),
        produto_id: product.id,
        nome: `[${product.categoria || 'Item'}] ${product.nome}`,
        quantidade: 1,
        maxStock: maxQty,
        valor_unitario: valorUnitario,
        tipo_preco: formData.tipoPreco
      }])
    }
  }

  const handleAddServicoToCart = (servico) => {
    const existingIndex = servicosVenda.findIndex(s => s.servico_id === servico.id)
    if (existingIndex >= 0) {
      const updatedServicos = [...servicosVenda]
      updatedServicos[existingIndex].quantidade += 1
      setServicosVenda(updatedServicos)
    } else {
      setServicosVenda([...servicosVenda, {
        id: Date.now(),
        servico_id: servico.id,
        nome: `[Serviço] ${servico.nome}`,
        quantidade: 1,
        valor_cobrado: servico.valor
      }])
    }
  }

  const filteredVendas = vendas.filter(venda => {
    if (filters.status && venda.status !== filters.status) return false

    if (venda.data) {
      const dataVenda = new Date(venda.data).getTime()
      if (filters.dataDe) {
        const de = new Date(filters.dataDe).getTime()
        if (dataVenda < de) return false
      }
      if (filters.dataAte) {
        const ate = new Date(filters.dataAte + 'T23:59:59').getTime()
        if (dataVenda > ate) return false
      }
    }

    if (filters.busca) {
      const busca = filters.busca.toLowerCase()
      const cliente = (venda.nome_cliente || '').toLowerCase()
      const documento = (venda.documento_cliente || '').toLowerCase()
      const matchesCliente = cliente.includes(busca)
      const matchesDoc = documento.includes(busca)
      if (!matchesCliente && !matchesDoc) return false
    }

    return true
  })

  const statsVendas = [
    { 
      icon: 'fa-shopping-cart', 
      bgClass: 'bg-blue-light', 
      title: 'Total de Vendas', 
      value: filteredVendas.length,
      subtitle: 'No período selecionado'
    },
    { 
      icon: 'fa-money-bill-trend-up', 
      bgClass: 'bg-green-light', 
      title: 'Faturamento Bruto', 
      value: formatCurrency(filteredVendas.filter(v => v.status === 'concluida').reduce((acc, v) => acc + v.valor_total, 0)),
      subtitle: 'Vendas concluídas'
    },
    { 
      icon: 'fa-clock', 
      bgClass: 'bg-yellow-light', 
      title: 'Vendas Pendentes', 
      value: filteredVendas.filter(v => v.status === 'pendente').length,
      subtitle: 'Aguardando confirmação'
    },
    { 
      icon: 'fa-chart-line', 
      bgClass: 'bg-purple-light', 
      title: 'Ticket Médio', 
      value: formatCurrency(
        filteredVendas.filter(v => v.status === 'concluida').length > 0 
          ? filteredVendas.filter(v => v.status === 'concluida').reduce((acc, v) => acc + v.valor_total, 0) / filteredVendas.filter(v => v.status === 'concluida').length 
          : 0
      ),
      subtitle: 'Valor médio por venda'
    },
  ]

  const handleChangeCartQuantity = (itemId, newQty) => {
    setItens(itens.map(item => {
      if (item.id === itemId) {
        let validQty = parseInt(newQty) || 1;
        if (validQty > item.maxStock) validQty = item.maxStock;
        if (validQty < 1) validQty = 1;
        return { ...item, quantidade: validQty }
      }
      return item;
    }))
  }

  const handleRemoveItem = (id) => {
    setItens(itens.filter(i => i.id !== id))
  }

  const handleChangeServicoQuantity = (id, newQty) => {
    setServicosVenda(servicosVenda.map(s => {
      if (s.id === id) {
        let validQty = parseInt(newQty) || 1;
        if (validQty < 1) validQty = 1;
        return { ...s, quantidade: validQty }
      }
      return s;
    }))
  }

  const handleRemoveServico = (id) => {
    setServicosVenda(servicosVenda.filter(s => s.id !== id))
  }

  const handlePriceTableChange = (novoTipo) => {
    setFormData({ ...formData, tipoPreco: novoTipo });
    setItens(itens.map(item => {
      const product = produtos.find(p => p.id === item.produto_id);
      if (product) {
        const novoValor = novoTipo === 'atacado' ? product.valor_atacado : product.valor_varejo;
        return { ...item, tipo_preco: novoTipo, valor_unitario: novoValor };
      }
      return item;
    }));
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      if (['dinheiro', 'pix', 'credito', 'debito', 'sucata'].includes(field)) {
        const total = calcularTotal();
        const pago = Object.entries(newData)
          .filter(([k]) => ['dinheiro', 'pix', 'credito', 'debito', 'sucata'].includes(k))
          .reduce((acc, [_, v]) => acc + parseCurrency(v), 0);
        
        // Lógica de troco automático removida para ser manual por padrão
        // const trocoSugestivo = Math.max(0, pago - total);
        // newData.troco_devolvido = formatCurrency(trocoSugestivo).replace('R$', '').trim();
      }
      
      return newData;
    });
  };

  const handleNovaVenda = () => {
    setEditingVendaId(null)
    setCurrentVenda(null)
    setItens([])
    setServicosVenda([])
    setFormData({
      cliente: '',
      documento: '',
      telefone: '',
      observacoes: '',
      data: new Date().toISOString().split('T')[0],
      tipoPreco: 'varejo',
      dinheiro: '',
      pix: '',
      credito: '',
      debito: '',
      sucata: '',
      troco_devolvido: '0,00'
    })
    setShowModal(true)
  }

  const handleEditVenda = async (v) => {
    setEditingVendaId(v.id)

    let vendaDetalhes = v
    let estoqueAgregado = []
    try {
      const [vendaRes, estoqueRes] = await Promise.all([
        vendaService.buscarPorId(v.id),
        estoqueService.listarEstoque() // qtd_atual já é o que está disponível na prateleira
      ])
      vendaDetalhes = vendaRes
      estoqueAgregado = Array.isArray(estoqueRes) ? estoqueRes : []
    } catch (err) {
      console.warn('Erro ao buscar dados para edição:', err)
    }

    let tipoPrecoPredominante = 'varejo';
    if (vendaDetalhes.itens && vendaDetalhes.itens.length > 0 && vendaDetalhes.itens[0].item_estoque?.produto) {
      if (vendaDetalhes.itens[0].valor_unitario === vendaDetalhes.itens[0].item_estoque.produto.valor_atacado) {
        tipoPrecoPredominante = 'atacado';
      }
    }

    setFormData({
      cliente: vendaDetalhes.nome_cliente || '',
      documento: vendaDetalhes.documento_cliente || '',
      telefone: vendaDetalhes.telefone_cliente || '',
      observacoes: vendaDetalhes.observacoes || '',
      data: new Date().toISOString().split('T')[0],
      tipoPreco: tipoPrecoPredominante,
      dinheiro: '',
      pix: '',
      credito: '',
      debito: '',
      sucata: '',
      troco_devolvido: vendaDetalhes.troco_devolvido ? vendaDetalhes.troco_devolvido.toString().replace('.', ',') : '0,00'
    })

    const groupedItens = []
    if (vendaDetalhes.itens) {
      // 1. Contar quantas unidades de cada produto já estão nesta venda
      const countNaVenda = {}
      vendaDetalhes.itens.forEach(it => {
        const pId = it.item_estoque?.produto?.id || it.item_estoque?.produto_id
        if (pId) countNaVenda[pId] = (countNaVenda[pId] || 0) + 1
      })

      // 2. Montar a cesta - máximo = qtd_atual (disponível na prateleira) + o que já está nesta venda
      const processados = new Set()
      vendaDetalhes.itens.forEach(it => {
        const prod = it.item_estoque?.produto
        const pId = prod?.id || it.item_estoque?.produto_id
        if (!pId || processados.has(pId)) return
        processados.add(pId)

        const estoqueEntry = estoqueAgregado.find(e => e.produto_id === pId)
        const qtdDisponivel = estoqueEntry?.qtd_atual || 0

        // Fórmula: disponível na prateleira + já reservados nessa venda
        const maxStock = qtdDisponivel + (countNaVenda[pId] || 0)

        groupedItens.push({
          id: `item-${pId}-${Date.now()}`,
          produto_id: pId,
          nome: prod ? `[${prod.categoria || 'Item'}] ${prod.nome}` : 'Produto Desconhecido',
          quantidade: countNaVenda[pId] || 1,
          maxStock,
          valor_unitario: it.valor_unitario,
          tipo_preco: tipoPrecoPredominante
        })
      })
    }
    setItens(groupedItens)

    const mappedServicos = []
    if (vendaDetalhes.servicos) {
      vendaDetalhes.servicos.forEach(s => {
        mappedServicos.push({
          id: `serv-${s.id}-${Date.now()}`,
          servico_id: s.servico_id,
          nome: `[Serviço] ${s.servico?.nome || 'Serviço'}`,
          quantidade: s.quantidade,
          valor_cobrado: s.valor_cobrado
        })
      })
    }
    setServicosVenda(mappedServicos)

    const pgs = { dinheiro: 0, pix: 0, credito: 0, debito: 0, sucata: 0 }
    if (vendaDetalhes.pagamentos) {
      vendaDetalhes.pagamentos.forEach(p => {
        if (pgs[p.tipo] !== undefined) {
          pgs[p.tipo] += p.valor
        }
      })
    }
    setFormData({
      cliente: vendaDetalhes.nome_cliente || '',
      empresa: vendaDetalhes.empresa || '',
      documento: vendaDetalhes.documento_cliente || '',
      telefone: vendaDetalhes.telefone_cliente || '',
      observacoes: vendaDetalhes.observacoes || '',
      troco_devolvido: (vendaDetalhes.troco_devolvido || 0).toString().replace('.', ','),
      tipoPreco: 'varejo',
      dinheiro: pgs.dinheiro > 0 ? (pgs.dinheiro).toString().replace('.', ',') : '',
      pix: pgs.pix > 0 ? (pgs.pix).toString().replace('.', ',') : '',
      credito: pgs.credito > 0 ? (pgs.credito).toString().replace('.', ',') : '',
      debito: pgs.debito > 0 ? (pgs.debito).toString().replace('.', ',') : '',
      sucata: pgs.sucata > 0 ? (pgs.sucata).toString().replace('.', ',') : '',
      data: vendaDetalhes.data ? new Date(vendaDetalhes.data).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    })

    setCurrentVenda(null)
    setShowModal(true)
  }
  
  const handleCancelEdit = () => {
    setEditingVendaId(null)
    setFormData({
      cliente: '',
      documento: '',
      telefone: '',
      observacoes: '',
      data: new Date().toISOString().split('T')[0],
      tipoPreco: 'varejo',
      dinheiro: '',
      pix: '',
      credito: '',
      debito: '',
      sucata: '',
      troco_devolvido: '0,00'
    })
    setItens([])
    setServicosVenda([])
  }

  const handleVisualizarVenda = (venda) => {
    setCurrentVenda(venda)
    setTempObs(venda.observacoes || '')
    setEditingObs(false)
    setShowModal(true)
  }

  const handleSaveObs = async () => {
    try {
      await vendaService.atualizarObservacoes(currentVenda.id, tempObs)
      setCurrentVenda({...currentVenda, observacoes: tempObs})
      setEditingObs(false)
      loadData()
    } catch (e) {
      alert("Erro ao salvar observação.")
    }
  }

  const handleDevolver = async () => {
    if(window.confirm("Reembolso Total: Confirma a devolução de todas as peças ao estoque e o estorno da venda? Esta ação é irreversível.")) {
      try {
        await vendaService.devolver(currentVenda.id)
        alert("Venda devolvida com sucesso!")
        setShowModal(false)
        loadData()
      } catch (e) {
        alert("Erro: " + e)
      }
    }
  }

  const handleSubmitVenda = async (e) => {
    e.preventDefault()

    if (!formData.cliente || !formData.cliente.trim()) {
      alert('Informe o nome do cliente antes de finalizar a venda.')
      return
    }

    if (itens.length === 0 && servicosVenda.length === 0) {
      alert('A venda deve conter ao menos um item físico ou um serviço.')
      return
    }

    setSubmitting(true)

    try {
      const payload = {
        nome_cliente: formData.cliente,
        empresa: formData.empresa,
        documento_cliente: formData.documento,
        telefone_cliente: formData.telefone,
        observacoes: formData.observacoes,
        troco_devolvido: parseCurrency(formData.troco_devolvido),
        itens: itens.reduce((acc, currentItem) => {
          for (let k = 0; k < currentItem.quantidade; k++) {
            acc.push({
              produto_id: currentItem.produto_id,
              tipo_preco: formData.tipoPreco
            });
          }
          return acc;
        }, []),
        servicos: servicosVenda.map(s => ({
          servico_id: s.servico_id,
          valor_cobrado: typeof s.valor_cobrado === 'string' ? parseCurrency(s.valor_cobrado) : s.valor_cobrado,
          quantidade: s.quantidade
        })),
        pagamentos: Object.entries(formData)
          .filter(([k, v]) => ['dinheiro', 'pix', 'credito', 'debito', 'sucata'].includes(k) && v !== '' && parseCurrency(v) > 0)
          .map(([k, v]) => ({
            tipo: k,
            valor: parseCurrency(v)
          }))
      };

      console.log("ENVIANDO PAYLOAD:", payload)

      if (editingVendaId) {
        await vendaService.atualizar(editingVendaId, payload)
        setEditingVendaId(null)
      } else {
        await vendaService.criar(payload)
      }

      setShowModal(false)
      setItens([])
      setServicosVenda([])
      setFormData({ cliente: '', documento: '', telefone: '', observacoes: '', data: new Date().toISOString().split('T')[0], tipoPreco: 'varejo', dinheiro: '', pix: '', credito: '', debito: '', sucata: '', troco_devolvido: '0,00' })
      loadData()
    } catch (err) {
      console.error('Erro ao salvar venda:', err)
      alert(err.message || 'Erro ao salvar venda')
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmarVenda = async (venda) => {
    try {
      await vendaService.confirmar(venda.id)
      loadData()
    } catch (err) {
      console.error('Erro ao confirmar venda:', err)
      alert(err.message || 'Erro ao confirmar venda')
    }
  }

  const handleCancelarVenda = async (venda) => {
    try {
      await vendaService.cancelar(venda.id)
      loadData()
    } catch (err) {
      console.error('Erro ao cancelar venda:', err)
      alert(err.message || 'Erro ao cancelar venda')
    }
  }

  const filteredProdutos = produtos.filter(p =>
    (p?.nome || '').toLowerCase().includes(search.toLowerCase())
  )

  const canManage = usuario?.perfil === 'admin' || usuario?.perfil === 'gerente' || usuario?.perfil === 'superadmin' || usuario?.perfil === 'vendas'

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Carregando vendas...</p>
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
        {statsVendas.map((stat, index) => (
          <div key={index} className="card stat-card">
            <div className={`stat-icon ${stat.bgClass}`}>
              <i className={`fas ${stat.icon}`}></i>
            </div>
            <div className="stat-info">
              <h3>{stat.title}</h3>
              <p>{stat.value}</p>
              <small style={{ color: '#64748b' }}>{stat.subtitle}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="filters-bar">
        <div className="filter-group">
          <div className="select-wrapper">
            <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Situação</label>
            <select 
              className="filter-input"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">Todos os Status</option>
              <option value="pendente">Pendente</option>
              <option value="concluida">Concluída</option>
              <option value="reembolsado">Reembolsada</option>
              <option value="devolvida">Devolvida</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>

          <div className="select-wrapper">
            <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Período</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="date" 
                className="filter-input"
                value={filters.dataDe}
                onChange={(e) => setFilters({ ...filters, dataDe: e.target.value })}
              />
              <input 
                type="date" 
                className="filter-input"
                value={filters.dataAte}
                onChange={(e) => setFilters({ ...filters, dataAte: e.target.value })}
              />
            </div>
          </div>

          <div style={{ flex: '1', display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Buscar Cliente</label>
            <input 
              type="text" 
              className="filter-input"
              placeholder="Nome do cliente ou documento..."
              value={filters.busca}
              onChange={(e) => setFilters({ ...filters, busca: e.target.value })}
              style={{ width: '100%' }}
            />
          </div>
        </div>
        {canManage && (
          <button type="button" className="btn btn-success" onClick={handleNovaVenda}>
            <FaPlus /> Nova Venda
          </button>
        )}
      </div>

      <div className="card table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Data</th>
              <th>Cliente</th>
              <th>Valor Total</th>
              <th>Valor Pago</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredVendas.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center' }}>Nenhuma venda encontrada</td>
              </tr>
            ) : (
              filteredVendas.map((venda) => (
                <tr key={venda.id}>
                  <td>{venda.id}</td>
                  <td>{venda.data ? new Date(venda.data).toLocaleDateString('pt-BR') : '---'}</td>
                  <td>{venda.nome_cliente}</td>
                  <td style={{ fontWeight: '600' }}>{formatCurrency(venda.valor_total)}</td>
                  <td style={{ color: venda.valor_pago !== venda.valor_total ? '#dc2626' : '#16a34a', fontWeight: '500' }}>{formatCurrency(venda.valor_pago)}</td>
                  <td>
                    <span className={`badge ${venda.status === 'concluida' ? 'badge-success' : (venda.status === 'cancelada' || venda.status === 'reembolsado' || venda.status === 'devolvida' ? 'badge-danger' : 'badge-warning')}`}>
                      {venda.status === 'concluida' ? 'Concluída' : 
                       venda.status === 'cancelada' ? 'Cancelada' : 
                       (venda.status === 'reembolsado' || venda.status === 'devolvida') ? 'Reembolsada' : 'Pendente'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className={`action-btn ${venda.status === 'pendente' && canManage ? 'action-btn-edit' : 'action-btn-view'}`}
                        onClick={() => (venda.status === 'pendente' && canManage) ? handleEditVenda(venda) : handleVisualizarVenda(venda)}
                        title={venda.status === 'pendente' && canManage ? "Editar Venda" : "Visualizar Detalhes"}
                      >
                        {venda.status === 'pendente' && canManage ? <FaEdit /> : <FaEye />}
                      </button>
                      {venda.status === 'pendente' && canManage && (
                        <>
                          <button
                            type="button"
                            className="action-btn action-btn-edit"
                            style={{ backgroundColor: '#10b981' }}
                            onClick={(e) => { e.stopPropagation(); handleConfirmarVenda(venda); }}
                            title="Confirmar Venda"
                          >
                            <FaCheck />
                          </button>
                          <button
                            type="button"
                            className="action-btn action-btn-delete"
                            onClick={(e) => { e.stopPropagation(); handleCancelarVenda(venda); }}
                            title="Cancelar Venda"
                          >
                            <FaTimes />
                          </button>
                        </>
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
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={() => setShowModal(false)}>
          <div className="modal-card" style={{ maxWidth: '800px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">
              {currentVenda ? `Visualizando Venda #${currentVenda.id}` : editingVendaId ? `Editando Venda #${editingVendaId}` : 'Nova Venda'}
            </h3>

            {currentVenda ? (
              <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '10px' }}>
                <div className="form-section" style={{ marginBottom: '25px', padding: '5px' }}>
                  <h4 style={{ borderBottom: '2px solid #f8fafc', paddingBottom: '8px', color: '#1e293b', fontSize: '1.1rem' }}>Dados do Cliente e Venda</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1.5fr) minmax(0, 1fr)', gap: '15px', marginBottom: '15px', marginTop: '15px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontWeight: '500', color: '#475569', fontSize: '0.9rem', marginBottom: '6px', display: 'block' }}>Cliente</label>
                      <input type="text" value={currentVenda.nome_cliente || '---'} readOnly style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f1f5f9' }} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontWeight: '500', color: '#475569', fontSize: '0.9rem', marginBottom: '6px', display: 'block' }}>Empresa</label>
                      <input type="text" value={currentVenda.empresa || '---'} readOnly style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f1f5f9' }} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontWeight: '500', color: '#475569', fontSize: '0.9rem', marginBottom: '6px', display: 'block' }}>{currentVenda.documento_cliente?.replace(/\D/g, '').length === 14 ? 'CNPJ' : 'Documento'}</label>
                      <input type="text" value={currentVenda.documento_cliente || '---'} readOnly style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f1f5f9' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontWeight: '500', color: '#475569', fontSize: '0.9rem', marginBottom: '6px', display: 'block' }}>Telefone / WhatsApp</label>
                      <input type="text" value={currentVenda.telefone_cliente || '---'} readOnly style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f1f5f9' }} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontWeight: '500', color: '#475569', fontSize: '0.9rem', marginBottom: '6px', display: 'block' }}>Data da Venda</label>
                      <input type="text" value={currentVenda.data ? new Date(currentVenda.data).toLocaleDateString('pt-BR') : '---'} readOnly style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f1f5f9' }} />
                    </div>
                  </div>
                </div>

                <div className="form-section" style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h4 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem' }}>Cesta de Produtos</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: '600' }}>Tabela de Preço:</label>
                      <select value={formData.tipoPreco} onChange={(e) => handlePriceTableChange(e.target.value)} style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '500', outline: 'none' }}>
                        <option value="varejo">Varejo (Consumidor)</option>
                        <option value="atacado">Atacado (Revenda)</option>
                      </select>
                    </div>
                  </div>
                  <div className="products-list" style={{ background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {currentVenda.itens && currentVenda.itens.length > 0 ? (
                      (() => {
                        const groupedItems = [];
                        currentVenda.itens.forEach(item => {
                          const prodId = item.item_estoque?.produto?.id;
                          const lote = item.item_estoque?.cod_lote || '';
                          const status = item.status || 'vendido';
                          const existing = groupedItems.find(g => 
                            g.prodId === prodId && 
                            g.lote === lote && 
                            g.valor_unitario === item.valor_unitario &&
                            g.status === status
                          );
                          
                          if (existing) {
                            existing.quantidade += 1;
                          } else {
                            groupedItems.push({
                              prodId,
                              lote,
                              status,
                              quantidade: 1,
                              valor_unitario: item.valor_unitario,
                              nomeProd: item.item_estoque?.produto?.nome || 'Produto',
                              categoria: item.item_estoque?.produto?.categoria || ''
                            });
                          }
                        });

                        return groupedItems.map((item, idx) => {
                          const statusColor = item.status === 'reembolsado' ? '#94a3b8' : '#1e293b';
                          const isReembolsado = item.status === 'reembolsado';

                          // Buscar os itens originais desta venda que pertencem a este grupo exato
                          const itensReais = currentVenda.itens.filter(iv => 
                            iv.item_estoque?.produto?.id === item.prodId && 
                            (iv.item_estoque?.cod_lote || '') === item.lote &&
                            iv.valor_unitario === item.valor_unitario &&
                            (iv.status || 'vendido') === item.status
                          );
                          const idsEstoque = itensReais.map(ir => `#${ir.item_estoque_id}`).join(', ');

                          return (
                            <div key={idx} className="product-item" style={{ 
                              display: 'flex', 
                              flexDirection: 'column', 
                              padding: '12px 15px', 
                              background: isReembolsado ? '#f1f5f9' : '#f8fafc', 
                              border: '1px solid #e2e8f0', 
                              borderRadius: '6px',
                              opacity: isReembolsado ? 0.7 : 1
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ 
                                  flex: '2', 
                                  fontWeight: '600', 
                                  color: statusColor, 
                                  fontSize: '0.95rem',
                                  textDecoration: isReembolsado ? 'line-through' : 'none'
                                }}>
                                  [{item.categoria || 'Item'}] {item.nomeProd} {item.lote ? ` - Lote: ${item.lote}` : ''} 
                                  {isReembolsado && (
                                    <span className="badge" style={{ marginLeft: "10px", fontSize: "10px", background: "#cbd5e1", color: "#475569" }}>REEMBOLSADO</span>
                                  )}
                                </div>
                                <div style={{ flex: '1', textAlign: 'center', color: '#475569', fontSize: '0.9rem' }}><span style={{ background: '#e2e8f0', padding: '4px 8px', borderRadius: '4px' }}>x{item.quantidade}</span></div>
                                <div style={{ flex: '1', textAlign: 'right', color: '#475569', fontSize: '0.9rem' }}>{formatCurrency(item.valor_unitario)}/un</div>
                                <div style={{ flex: '1.2', textAlign: 'right', fontWeight: 'bold', color: isReembolsado ? '#94a3b8' : '#0f172a', fontSize: '1rem' }}>{formatCurrency(item.quantidade * item.valor_unitario)}</div>
                              </div>
                              <div style={{ marginTop: '6px', fontSize: '0.75rem', color: isReembolsado ? '#94a3b8' : '#64748b', borderTop: '1px dashed #ced4da', paddingTop: '4px' }}>
                                <strong>IDs Estoque:</strong> {idsEstoque}
                              </div>
                            </div>
                          );
                        });
                      })()
                    ) : null}

                    {currentVenda.servicos && currentVenda.servicos.length > 0 && (
                      currentVenda.servicos.map((s, idx) => (
                        <div key={`serv-${idx}`} className="product-item" style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          padding: '12px 15px', 
                          background: currentVenda.status === 'reembolsado' ? '#f1f5f9' : '#f8fafc', 
                          border: '1px solid #e2e8f0', 
                          borderRadius: '6px',
                          opacity: currentVenda.status === 'reembolsado' ? 0.7 : 1
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ 
                              flex: '2', 
                              fontWeight: '600', 
                              color: currentVenda.status === 'reembolsado' ? '#94a3b8' : '#1e293b', 
                              fontSize: '0.95rem',
                              textDecoration: currentVenda.status === 'reembolsado' ? 'line-through' : 'none'
                            }}>
                              [Serviço] {s.servico?.nome || 'Serviço'}
                            </div>
                            <div style={{ flex: '1', textAlign: 'center', color: '#475569', fontSize: '0.9rem' }}><span style={{ background: '#e2e8f0', padding: '4px 8px', borderRadius: '4px' }}>x{s.quantidade}</span></div>
                            <div style={{ flex: '1', textAlign: 'right', color: '#475569', fontSize: '0.9rem' }}>{formatCurrency(s.valor_cobrado)}/un</div>
                            <div style={{ flex: '1.2', textAlign: 'right', fontWeight: 'bold', color: currentVenda.status === 'reembolsado' ? '#94a3b8' : '#0f172a', fontSize: '1rem' }}>{formatCurrency(s.quantidade * s.valor_cobrado)}</div>
                          </div>
                        </div>
                      ))
                    )}
                    
                    {(!currentVenda.itens || currentVenda.itens.length === 0) && (!currentVenda.servicos || currentVenda.servicos.length === 0) && (
                      <div style={{ textAlign: 'center', color: '#a1a1aa', padding: '20px 0', fontSize: '0.95rem' }}>
                        <p style={{ margin: 0, fontStyle: 'italic' }}>Nenhum item ou serviço listado</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-section" style={{ padding: '0 5px' }}>
                  <h4 style={{ margin: '0 0 15px 0', borderBottom: '2px solid #f8fafc', paddingBottom: '8px', color: '#1e293b', fontSize: '1.1rem' }}>Pagamentos (Composição de Saldo)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '20px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500', marginBottom: '6px', display: 'block' }}>Dinheiro</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8', fontSize: '0.9rem', fontWeight: '500' }}>R$</span>
                        <input type="text" value={formatCurrency(currentVenda.pagamentos?.find(p => p.tipo === 'dinheiro')?.valor || 0).replace('R$', '').trim()} readOnly style={{ width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8fafc', fontSize: '0.95rem' }} />
                      </div>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500', marginBottom: '6px', display: 'block' }}>Pix</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8', fontSize: '0.9rem', fontWeight: '500' }}>R$</span>
                        <input type="text" value={formatCurrency(currentVenda.pagamentos?.find(p => p.tipo === 'pix')?.valor || 0).replace('R$', '').trim()} readOnly style={{ width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8fafc', fontSize: '0.95rem' }} />
                      </div>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500', marginBottom: '6px', display: 'block' }}>Crédito</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8', fontSize: '0.9rem', fontWeight: '500' }}>R$</span>
                        <input type="text" value={formatCurrency(currentVenda.pagamentos?.find(p => p.tipo === 'credito')?.valor || 0).replace('R$', '').trim()} readOnly style={{ width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8fafc', fontSize: '0.95rem' }} />
                      </div>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500', marginBottom: '6px', display: 'block' }}>Débito</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8', fontSize: '0.9rem', fontWeight: '500' }}>R$</span>
                        <input type="text" value={formatCurrency(currentVenda.pagamentos?.find(p => p.tipo === 'debito')?.valor || 0).replace('R$', '').trim()} readOnly style={{ width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8fafc', fontSize: '0.95rem' }} />
                      </div>
                    </div>
                    <div className="form-group" style={{ margin: 0, gridColumn: 'span 4' }}>
                      <label style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500', marginBottom: '6px', display: 'block' }}>Abatimento Sucata</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8', fontSize: '0.9rem', fontWeight: '500' }}>R$</span>
                        <input type="text" value={formatCurrency(currentVenda.pagamentos?.find(p => p.tipo === 'sucata')?.valor || 0).replace('R$', '').trim()} readOnly style={{ width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8fafc', fontSize: '0.95rem' }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginTop: '10px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>VALOR DA VENDA</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8', fontSize: '0.9rem', fontWeight: '500' }}>R$</span>
                        <input type="text" value={formatCurrency(currentVenda.valor_total).replace('R$', '').trim()} readOnly style={{ width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #cbd5e1', background: '#f8fafc', borderRadius: '6px', fontWeight: '800', color: '#1e293b', fontSize: '0.95rem', textAlign: 'right' }} />
                      </div>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.82rem', color: '#10b981', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>TOTAL RECEBIDO</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '10px', color: '#10b981', opacity: '0.7', fontSize: '0.9rem', fontWeight: '500' }}>R$</span>
                        <input type="text" value={formatCurrency(currentVenda.valor_pago).replace('R$', '').trim()} readOnly style={{ width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #10b981', background: '#ecfdf5', borderRadius: '6px', fontWeight: '800', color: '#059669', fontSize: '0.95rem', textAlign: 'right' }} />
                      </div>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.82rem', color: '#3b82f6', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>TROCO A DEVOLVER</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '10px', color: '#3b82f6', opacity: '0.7', fontSize: '0.9rem', fontWeight: '500' }}>R$</span>
                        <input type="text" value={formatCurrency(currentVenda.troco).replace('R$', '').trim()} readOnly style={{ width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #3b82f6', background: '#eff6ff', borderRadius: '6px', fontWeight: '800', color: '#1d4ed8', fontSize: '0.95rem', textAlign: 'right' }} />
                      </div>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.82rem', color: '#0891b2', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>TROCO DEVOLVIDO</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '10px', color: '#0891b2', opacity: '0.7', fontSize: '0.9rem', fontWeight: '500' }}>R$</span>
                        <input type="text" value={formatCurrency(currentVenda.troco_devolvido).replace('R$', '').trim()} readOnly style={{ width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #0891b2', background: '#ecfeff', borderRadius: '6px', fontWeight: '800', color: '#0e7490', fontSize: '0.95rem', textAlign: 'right' }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-section" style={{ padding: '0 5px', marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontWeight: '500', color: '#475569', fontSize: '0.9rem', display: 'block' }}>Observações</label>
                    {!editingObs ? (
                      <button type="button" onClick={() => setEditingObs(true)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '0.85rem' }}><FaEdit /> Editar Notas</button>
                    ) : (
                      <button type="button" onClick={handleSaveObs} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}><FaCheck /> Salvar Mudanças</button>
                    )}
                  </div>
                  <textarea rows="3" value={editingObs ? tempObs : (currentVenda.observacoes || 'Sem observações.')} onChange={(e) => setTempObs(e.target.value)} readOnly={!editingObs} style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', resize: 'vertical', background: editingObs ? '#fff' : '#f1f5f9' }} />
                </div>
                <div className="modal-actions" style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', gap: '15px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" onClick={() => vendaService.gerarComprovante(currentVenda.id)} style={{ padding: '12px 24px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><FaFilePdf /> Baixar Comprovante</button>
                    {currentVenda.status === 'concluida' && (
                        <button type="button" onClick={handleDevolver} style={{ padding: '12px 24px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Realizar Reembolso Total</button>
                    )}
                  </div>
                  <button type="button" className="btn btn-cancel" onClick={() => setShowModal(false)} style={{ padding: '12px 24px', fontWeight: '600', borderRadius: '6px', fontSize: '0.95rem' }}>Fechar Painel</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitVenda} style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '10px' }}>
                <div className="form-section" style={{ marginBottom: '25px', padding: '5px' }}>
                  <h4 style={{ borderBottom: '2px solid #f8fafc', paddingBottom: '8px', color: '#1e293b', fontSize: '1.1rem' }}>Dados do Cliente e Venda</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1.5fr) minmax(0, 1fr)', gap: '15px', marginBottom: '15px', marginTop: '15px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontWeight: '500', color: '#475569', fontSize: '0.9rem', marginBottom: '6px', display: 'block' }}>Cliente *</label>
                      <input type="text" placeholder="Nome Completo" value={formData.cliente} onChange={(e) => handleInputChange('cliente', e.target.value)} required style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem' }} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontWeight: '500', color: '#475569', fontSize: '0.9rem', marginBottom: '6px', display: 'block' }}>Empresa (Opcional)</label>
                      <input type="text" placeholder="Razão Social" value={formData.empresa || ''} onChange={(e) => handleInputChange('empresa', e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem' }} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontWeight: '500', color: '#475569', fontSize: '0.9rem', marginBottom: '6px', display: 'block' }}>{formData.documento?.replace(/\D/g, '').length === 14 ? 'CNPJ' : 'Doc.'} (Opcional)</label>
                      <input type="text" placeholder="CPF / CNPJ" value={formData.documento} onChange={(e) => handleInputChange('documento', maskCPF_CNPJ(e.target.value))} style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontWeight: '500', color: '#475569', fontSize: '0.9rem', marginBottom: '6px', display: 'block' }}>Telefone / WhatsApp</label>
                      <input type="text" placeholder="(00) 00000-0000" value={formData.telefone} onChange={(e) => handleInputChange('telefone', e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem' }} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontWeight: '500', color: '#475569', fontSize: '0.9rem', marginBottom: '6px', display: 'block' }}>Data de Registro *</label>
                      <input type="date" value={formData.data} onChange={(e) => handleInputChange('data', e.target.value)} required style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem' }} />
                    </div>
                  </div>
                </div>

                <div className="form-section" style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h4 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem' }}>Cesta de Produtos</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <label style={{ fontSize: '0.85rem', color: '#475569', fontWeight: '600' }}>Tabela de Preço:</label>
                      <select value={formData.tipoPreco} onChange={(e) => handlePriceTableChange(e.target.value)} style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '500', outline: 'none' }}>
                        <option value="varejo">Varejo (Consumidor)</option>
                        <option value="atacado">Atacado (Revenda)</option>
                      </select>
                    </div>
                  </div>
                  <div className="products-list" style={{ background: 'white', borderRadius: '6px', border: '1px dashed #cbd5e1', padding: '15px', minHeight: '90px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {itens.map((item) => (
                      <div key={item.id} className="product-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 15px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                        <div style={{ flex: '2', fontWeight: '600', color: '#1e293b', fontSize: '0.95rem' }}>{item.nome}</div>
                        <div style={{ flex: '1', textAlign: 'center' }}>
                          <input 
                            type="number" 
                            min="1" 
                            max={item.maxStock} 
                            value={item.quantidade} 
                            onChange={(e) => handleChangeCartQuantity(item.id, e.target.value)} 
                            style={{ width: '60px', padding: '4px', textAlign: 'center', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#f8fafc' }} 
                          />
                          <div style={{fontSize: '0.7rem', color: '#64748b', marginTop: '2px'}}>Máx: {item.maxStock}</div>
                        </div>
                        <div style={{ flex: '1', textAlign: 'right', color: '#475569', fontSize: '0.9rem' }}>{formatCurrency(item.valor_unitario)}/un</div>
                        <div style={{ flex: '1.2', textAlign: 'right', fontWeight: 'bold', color: '#0f172a', fontSize: '1rem' }}>{formatCurrency(item.quantidade * item.valor_unitario)}</div>
                        <div style={{ marginLeft: '15px' }}>
                          <button type="button" className="btn-remove" style={{ background: '#fff0f2', color: '#e11d48', border: '1px solid #ffe4e6', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => handleRemoveItem(item.id)} title="Remover Produto"><FaTrash /></button>
                        </div>
                      </div>
                    ))}
                    {servicosVenda.map((serv) => (
                      <div key={serv.id} className="product-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 15px', background: '#fdf8f6', border: '1px solid #fed7aa', borderRadius: '6px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                        <div style={{ flex: '2', fontWeight: '600', color: '#9a3412', fontSize: '0.95rem' }}>{serv.nome}</div>
                        <div style={{ flex: '1', textAlign: 'center' }}>
                          <input 
                            type="number" 
                            min="1" 
                            value={serv.quantidade} 
                            onChange={(e) => handleChangeServicoQuantity(serv.id, e.target.value)} 
                            style={{ width: '60px', padding: '4px', textAlign: 'center', border: '1px solid #fdba74', borderRadius: '4px', background: '#fff' }} 
                          />
                        </div>
                        <div style={{ flex: '1', textAlign: 'right' }}>
                          <input 
                            type="number" 
                            step="0.01" 
                            value={serv.valor_cobrado} 
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setServicosVenda(servicosVenda.map(s => s.id === serv.id ? { ...s, valor_cobrado: val } : s));
                            }} 
                            style={{ width: '90px', padding: '4px', textAlign: 'right', border: '1px solid #fdba74', borderRadius: '4px', background: '#fff' }} 
                          />
                        </div>
                        <div style={{ flex: '1.2', textAlign: 'right', fontWeight: 'bold', color: '#7c2d12', fontSize: '1rem' }}>{formatCurrency(serv.quantidade * serv.valor_cobrado)}</div>
                        <div style={{ marginLeft: '15px' }}>
                          <button type="button" className="btn-remove" style={{ background: '#fff0f2', color: '#e11d48', border: '1px solid #ffe4e6', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => handleRemoveServico(serv.id)} title="Remover Serviço"><FaTrash /></button>
                        </div>
                      </div>
                    ))}
                    {itens.length === 0 && servicosVenda.length === 0 && (
                      <div style={{ textAlign: 'center', color: '#a1a1aa', padding: '20px 0', fontSize: '0.95rem' }}>
                        <p style={{ margin: 0, fontStyle: 'italic' }}>A cesta está vazia</p>
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: '15px', textAlign: 'left', display: 'flex', gap: '10px' }}>
                    <button type="button" className="btn btn-primary" onClick={async () => { try { const freshEstoque = await estoqueService.listarEstoque(); setEstoques(Array.isArray(freshEstoque) ? freshEstoque : []) } catch(e) {} setShowListModal(true) }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#3b82f6', color: 'white', borderRadius: '6px', fontWeight: '600', border: 'none' }}>
                      <FaPlus /> Adicionar Produto à Cesta
                    </button>
                    <button type="button" className="btn btn-warning" onClick={() => setShowServicoModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#f59e0b', color: 'white', borderRadius: '6px', fontWeight: '600', border: 'none' }}>
                      <FaPlus /> Adicionar Serviço
                    </button>
                  </div>
                </div>

                <div className="form-section" style={{ padding: '0 5px' }}>
                  <h4 style={{ margin: '0 0 15px 0', borderBottom: '2px solid #f8fafc', paddingBottom: '8px', color: '#1e293b', fontSize: '1.1rem' }}>Pagamentos (Composição de Saldo)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '20px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500', marginBottom: '6px', display: 'block' }}>Dinheiro</label>
                      <div style={{ position: 'relative' }}><span style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8', fontSize: '0.9rem', fontWeight: '500' }}>R$</span>
                        <input type="text" placeholder="0,00" value={formData.dinheiro} onChange={(e) => handleInputChange('dinheiro', e.target.value)} style={{ width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem' }} /></div>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500', marginBottom: '6px', display: 'block' }}>Transferência/Pix</label>
                      <div style={{ position: 'relative' }}><span style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8', fontSize: '0.9rem', fontWeight: '500' }}>R$</span>
                        <input type="text" placeholder="0,00" value={formData.pix} onChange={(e) => handleInputChange('pix', e.target.value)} style={{ width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem' }} /></div>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500', marginBottom: '6px', display: 'block' }}>Cartão (Crédito)</label>
                      <div style={{ position: 'relative' }}><span style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8', fontSize: '0.9rem', fontWeight: '500' }}>R$</span>
                        <input type="text" placeholder="0,00" value={formData.credito} onChange={(e) => handleInputChange('credito', e.target.value)} style={{ width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem' }} /></div>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500', marginBottom: '6px', display: 'block' }}>Cartão (Débito)</label>
                      <div style={{ position: 'relative' }}><span style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8', fontSize: '0.9rem', fontWeight: '500' }}>R$</span>
                        <input type="text" placeholder="0,00" value={formData.debito} onChange={(e) => handleInputChange('debito', e.target.value)} style={{ width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem' }} /></div>
                    </div>
                    <div className="form-group" style={{ margin: 0, gridColumn: 'span 4' }}>
                      <label style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500', marginBottom: '6px', display: 'block' }}>Abatimento Sucata</label>
                      <div style={{ position: 'relative' }}><span style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8', fontSize: '0.9rem', fontWeight: '500' }}>R$</span>
                        <input type="text" placeholder="0,00" value={formData.sucata} onChange={(e) => handleInputChange('sucata', e.target.value)} style={{ width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem', background: '#f8fafc' }} /></div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginTop: '20px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>VALOR TOTAL DA VENDA</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8', fontSize: '0.9rem', fontWeight: '500' }}>R$</span>
                        <input type="text" value={formatCurrency(calcularTotal()).replace('R$', '').trim()} readOnly style={{ width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #cbd5e1', background: '#f8fafc', borderRadius: '6px', fontWeight: '800', color: '#1e293b', fontSize: '0.95rem', textAlign: 'right' }} />
                      </div>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.82rem', color: '#10b981', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>TOTAL PAGO / RECEBIDO</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '10px', color: '#10b981', opacity: '0.7', fontSize: '0.9rem', fontWeight: '500' }}>R$</span>
                        <input type="text" value={formatCurrency(Object.entries(formData).filter(([k]) => ['dinheiro', 'pix', 'credito', 'debito', 'sucata'].includes(k)).reduce((acc, [_, v]) => acc + parseCurrency(v), 0)).replace('R$', '').trim()} readOnly style={{ width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #10b981', background: '#ecfdf5', borderRadius: '6px', fontWeight: '800', color: '#059669', fontSize: '0.95rem', textAlign: 'right' }} />
                      </div>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.82rem', color: '#3b82f6', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>TROCO A DEVOLVER</label>
                      {(() => {
                        const total = calcularTotal();
                        const pago = Object.entries(formData).filter(([k]) => ['dinheiro', 'pix', 'credito', 'debito', 'sucata'].includes(k)).reduce((acc, [_, v]) => acc + parseCurrency(v), 0);
                        const troco = Math.max(0, pago - total);
                        return (
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '10px', top: '10px', color: '#3b82f6', opacity: '0.7', fontSize: '0.9rem', fontWeight: '500' }}>R$</span>
                            <input type="text" value={formatCurrency(troco).replace('R$', '').trim()} readOnly style={{ width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #3b82f6', background: '#eff6ff', borderRadius: '6px', fontWeight: '800', color: '#1d4ed8', fontSize: '0.95rem', textAlign: 'right' }} />
                          </div>
                        );
                      })()}
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.82rem', color: '#0891b2', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>TROCO DEVOLVIDO</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '10px', color: '#0891b2', opacity: '0.7', fontSize: '0.9rem', fontWeight: '500' }}>R$</span>
                        <input 
                          type="text" 
                          value={formData.troco_devolvido} 
                          onChange={(e) => handleInputChange('troco_devolvido', e.target.value)}
                          style={{ width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #0891b2', background: '#ecfeff', borderRadius: '6px', fontWeight: '800', color: '#0e7490', fontSize: '0.95rem', textAlign: 'right' }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-section" style={{ padding: '0 5px', marginTop: '20px' }}>
                  <label style={{ fontWeight: '500', color: '#475569', fontSize: '0.9rem', marginBottom: '6px', display: 'block' }}>Observações</label>
                  <textarea rows="2" placeholder="Adicione informações extras..." value={formData.observacoes} onChange={(e) => handleInputChange('observacoes', e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', resize: 'vertical', fontSize: '0.95rem', background: '#f8fafc' }} />
                </div>

                <div className="modal-actions" style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', gap: '15px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                  <button type="button" className="btn btn-cancel" onClick={() => { setShowModal(false); setEditingVendaId(null) }} style={{ padding: '12px 24px', fontWeight: '600', borderRadius: '6px', fontSize: '0.95rem' }}>Descartar e Sair</button>
                  <button type="submit" className="btn btn-success" disabled={submitting} style={{ padding: '12px 32px', fontWeight: 'bold', fontSize: '1rem', background: '#10b981', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}>{submitting ? 'Processando...' : editingVendaId ? 'Salvar Alterações' : 'Finalizar Venda'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showListModal && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={() => setShowListModal(false)}>
          <div className="modal-card" style={{ width: '600px', maxWidth: '90%' }} onClick={(e) => e.stopPropagation()}>
            <h3>Catálogo de Produtos</h3>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>

              <input 
                type="text" 
                placeholder="Pesquisar categoria ou nome..." 
                className="filter-input-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                style={{ flex: 1 }}
              />
            </div>
            <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th>Produto</th>
                    <th>Valor</th>
                    <th>Estoque</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.filter(p => !search || p.nome.toLowerCase().includes(search.toLowerCase()) || p.categoria.toLowerCase().includes(search.toLowerCase())).map(p => {
                    const availableItems = itensEstoque.filter(i => i.produto_id === p.id && i.estado === 'disponivel');
                    const stockLabel = availableItems.length;
                    const isOutOfStock = stockLabel === 0;
                    const valor = formData.tipoPreco === 'atacado' ? p.valor_atacado : p.valor_varejo;
                    
                    // Add maxStock to the product object passed to the cart
                    const productWithStock = { ...p, maxStock: stockLabel };
                    return (
                      <tr key={p.id}>
                        <td><span className="badge badge-info">{p.categoria}</span></td>
                        <td>{p.nome}</td>
                        <td>{formatCurrency(valor)}</td>
                        <td>
                           <span className={isOutOfStock ? "status-out-stock" : "status-in-stock"} style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                              {stockLabel}
                           </span>
                        </td>
                        <td>
                          <button 
                            type="button" 
                            className="btn btn-sm btn-success" 
                            disabled={isOutOfStock}
                            onClick={() => handleAddDirectToCart(productWithStock)}
                          >
                            Add
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button type="button" className="btn btn-cancel" onClick={() => setShowListModal(false)}>Fechar Catálogo</button>
            </div>
          </div>
        </div>
      )}

      {showProductModal && selectedProduct && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={() => setShowProductModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Selecionar Produto</h3>
            <div className="form-field" style={{ margin: '20px 0' }}>
              <label>Produto:</label>
              <input
                type="text"
                value={selectedProduct.nome}
                readOnly
                style={{ background: '#f0f0f0' }}
              />
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Preço Varejo:</label>
                <input type="text" value={formatCurrency(selectedProduct.valor_varejo)} readOnly />
              </div>
              <div className="form-field">
                <label>Preço Atacado:</label>
                <input type="text" value={formatCurrency(selectedProduct.valor_atacado)} readOnly />
              </div>
            </div>
            <div className="form-field">
              <label>Quantidade *</label>
              <input
                type="number"
                min="1"
                max={selectedProduct?.maxStock || 1}
                value={quantity}
                onChange={(e) => {
                   let val = parseInt(e.target.value) || 1;
                   if (val > selectedProduct.maxStock) val = selectedProduct.maxStock;
                   setQuantity(val);
                }}
                required
              />
              <span style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px', display: 'block' }}>Máximo disponível: {selectedProduct?.maxStock}</span>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-cancel" onClick={() => setShowProductModal(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-success" onClick={handleConfirmProduct}>
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {showServicoModal && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={() => setShowServicoModal(false)}>
          <div className="modal-card" style={{ width: '600px', maxWidth: '90%' }} onClick={(e) => e.stopPropagation()}>
            <h3>Catálogo de Serviços</h3>
            <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Serviço</th>
                    <th>Valor Base</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {servicosDisponiveis.map(s => (
                    <tr key={s.id}>
                      <td>{s.nome}</td>
                      <td>{formatCurrency(s.valor)}</td>
                      <td>
                        <button 
                          type="button" 
                          className="btn btn-sm btn-warning" 
                          onClick={() => { handleAddServicoToCart(s); setShowServicoModal(false); }}
                        >
                          Adicionar Serviço
                        </button>
                      </td>
                    </tr>
                  ))}
                  {servicosDisponiveis.length === 0 && (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center' }}>Nenhum serviço cadastrado no sistema.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button type="button" className="btn btn-cancel" onClick={() => setShowServicoModal(false)}>Fechar Catálogo</button>
            </div>
          </div>
        </div>
      )}
    
      {/* Comprovante removido da visualização direta para limpeza da interface */}
    </>
  )
}

export default Vendas
