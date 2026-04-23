package relatorio

import (
	"fmt"
	"super-br/internal/domain/estoque"
	"super-br/internal/domain/movimentacao"
	"super-br/internal/domain/sucata"
	"super-br/internal/domain/venda"
	"super-br/internal/domain/movimentacao_sucata"
	"strings" // Adicionado para formatação monetária
	"time"

	"github.com/jung-kurt/gofpdf"
	"gorm.io/gorm"
)

type Service struct {
	db             *gorm.DB
	vendaService   *venda.Service
	estoqueService *estoque.Service
	movService     *movimentacao.Service
	sucataService  *sucata.Service
}

func NewService(db *gorm.DB, vendaSvc *venda.Service, estoqueSvc *estoque.Service, movSvc *movimentacao.Service, sucataSvc *sucata.Service) *Service {
	return &Service{
		db:             db,
		vendaService:   vendaSvc,
		estoqueService: estoqueSvc,
		movService:     movSvc,
		sucataService:  sucataSvc,
	}
}

// formatarMoedaBRL formata um float64 para o padrão brasileiro: R$ 1.234,56
func formatarMoedaBRL(valor float64) string {
	s := fmt.Sprintf("%.2f", valor)
	partes := strings.Split(s, ".")
	inteiro := partes[0]
	decimal := partes[1]

	var resultado []byte
	n := len(inteiro)
	for i := 0; i < n; i++ {
		if i > 0 && (n-i)%3 == 0 {
			resultado = append(resultado, '.')
		}
		resultado = append(resultado, inteiro[i])
	}

	return "R$ " + string(resultado) + "," + decimal
}

// --- Funções Auxiliares de Estilo PDF ---

func (s *Service) aplicarCabecalhoProfissional(pdf *gofpdf.Fpdf, titulo string, infoExtra string) {
	tr := pdf.UnicodeTranslatorFromDescriptor("cp1252")

	// Barra Superior Colorida (Azul SuperBR)
	pdf.SetFillColor(10, 31, 68) // #0A1F44
	pdf.Rect(0, 0, 210, 35, "F")

	// Texto do Cabeçalho
	pdf.SetTextColor(255, 255, 255)
	pdf.SetFont("Arial", "B", 18)
	pdf.SetXY(15, 12)
	pdf.Cell(0, 5, tr("BATERIAS SUPER BR"))

	pdf.SetFont("Arial", "", 10)
	pdf.SetXY(15, 20)
	pdf.Cell(0, 5, tr("Sistema de Gestão de Estoque e Vendas"))

	// Título do Relatório (Centralizado/Direita)
	pdf.SetFont("Arial", "B", 14)
	pdf.SetXY(120, 12)
	pdf.CellFormat(75, 5, tr(titulo), "", 0, "R", false, 0, "")

	pdf.SetFont("Arial", "I", 9)
	pdf.SetXY(120, 20)
	pdf.CellFormat(75, 5, tr(infoExtra), "", 0, "R", false, 0, "")

	pdf.SetTextColor(0, 0, 0) // Reset cor do texto
	pdf.Ln(25)
}

func (s *Service) desenharCard(pdf *gofpdf.Fpdf, x, y, w, h float64, label, valor string, corR, corG, corB int) {
	pdf.SetFillColor(250, 250, 250) // Levemente mais claro
	pdf.Rect(x, y, w, h, "F")
	
	// Bordinha lateral colorida - mais espessa (3mm)
	pdf.SetFillColor(corR, corG, corB)
	pdf.Rect(x, y, 3, h, "F")

	pdf.SetFont("Arial", "B", 8) // Reduzido para label
	pdf.SetTextColor(80, 80, 80)
	pdf.SetXY(x+5, y+5)
	pdf.Cell(0, 5, label)

	pdf.SetFont("Arial", "B", 12) // Reduzido valor p/ caber melhor em cards menores
	pdf.SetTextColor(20, 20, 20)
	pdf.SetXY(x+5, y+12)
	pdf.Cell(0, 5, valor)
}

func (s *Service) contarItens(r *ResumoVenda) int {
	total := 0
	for _, v := range r.Volumes { total += v.Quantidade }
	return total
}

// VolumePorProduto detalha as vendas por item específico
type VolumePorProduto struct {
	Produto    string  `json:"produto"`
	Categoria  string  `json:"categoria"`
	Quantidade int     `json:"quantidade"`
	ValorTotal float64 `json:"valor_total"` // Novo: Faturamento bruto por item
}

// ResumoVenda representa os dados agregados para o relatório
type ResumoVenda struct {
	PeriodoInicio  time.Time           `json:"periodo_inicio"`
	PeriodoFim     time.Time           `json:"periodo_fim"`
	TotalProdutos  float64             `json:"total_produtos"`   // Valor nominal das baterias (Bruto)
	TotalRecebido  float64             `json:"total_recebido"`   // O que o cliente entregou total
	TotalTrocoReal float64             `json:"total_troco_real"` // O que saiu de troco na prática
	ReceitaLiquida     float64             `json:"receita_liquida"`  // O que ficou no caixa (Recebido - Troco)
	TotalItensEstoque  int                 `json:"total_itens_estoque"` // Novo: Saldo atual do estoque (Geral)
	Volumes            []VolumePorProduto  `json:"volumes"`          // Novo: Lista detalhada por produto
	PorPagamento   map[string]float64  `json:"por_pagamento"`
	PorStatus      map[string]int      `json:"por_status"`
	Vendas         []venda.Venda       `json:"vendas"`
}

// ObterDadosVendas busca e agrega dados de vendas no período
func (s *Service) ObterDadosVendas(inicio, fim time.Time) (*ResumoVenda, error) {
	var vendas []venda.Venda
	
	// Ajustar períodos para abranger o dia inteiro seguindo o fuso local do banco
	loc, _ := time.LoadLocation("America/Sao_Paulo")
	inicioAjustado := time.Date(inicio.Year(), inicio.Month(), inicio.Day(), 0, 0, 0, 0, loc)
	fimAjustado := time.Date(fim.Year(), fim.Month(), fim.Day(), 23, 59, 59, 999999999, loc)

	err := s.db.Preload("Itens.ItemEstoque.Produto").
		Preload("Pagamentos").
		Preload("Usuario"). // Preload do vendedor
		Where("data >= ? AND data <= ?", inicioAjustado, fimAjustado).
		Find(&vendas).Error
	if err != nil {
		return nil, err
	}

	resumo := &ResumoVenda{
		PeriodoInicio: inicio,
		PeriodoFim:    fim,
		PorPagamento:  make(map[string]float64),
		PorStatus:     make(map[string]int),
		Vendas:        vendas,
	}

	// Mapa temporário para agrupar por ProdutoID para facilitar a soma
	mapVolumes := make(map[string]*VolumePorProduto)

	for _, v := range vendas {
		resumo.PorStatus[v.Status]++

		// Apenas vendas concluídas somam no fluxo financeiro
		if v.Status == "concluida" {
			resumo.TotalProdutos += v.ValorTotal
			
			var pagoNaVenda float64
			for _, p := range v.Pagamentos {
				pagoNaVenda += p.Valor
				resumo.PorPagamento[p.Tipo] += p.Valor
			}
			
			resumo.TotalRecebido += pagoNaVenda
			resumo.TotalTrocoReal += v.TrocoDevolvido
			resumo.ReceitaLiquida += (pagoNaVenda - v.TrocoDevolvido)
		}

		// Agregar por Produto + Categoria
		for _, item := range v.Itens {
			if item.ItemEstoque.ID != 0 && item.ItemEstoque.Produto.ID != 0 {
				chave := fmt.Sprintf("%d", item.ItemEstoque.Produto.ID)
				vTotalItem := item.ValorUnitario * float64(item.Quantidade)
				
				if vol, ok := mapVolumes[chave]; ok {
					vol.Quantidade += item.Quantidade
					vol.ValorTotal += vTotalItem
				} else {
					cat := item.ItemEstoque.Produto.Categoria
					if cat == "" { cat = "N/D" }
					mapVolumes[chave] = &VolumePorProduto{
						Produto:    item.ItemEstoque.Produto.Nome,
						Categoria:  cat,
						Quantidade: item.Quantidade,
						ValorTotal: vTotalItem,
					}
				}
			}
		}
	}

	// Converte o mapa de volumes para a slice final do resumo
	for _, vol := range mapVolumes {
		resumo.Volumes = append(resumo.Volumes, *vol)
	}

	// Adicionar o saldo atual do estoque para o dashboard
	var totalItens int64
	s.db.Model(&estoque.ItemEstoque{}).
		Where("estado IN ?", []string{"disponivel", "reservado", "reembolsado"}).
		Count(&totalItens)
	resumo.TotalItensEstoque = int(totalItens)

	return resumo, nil
}

// GerarPDFVendas cria o documento PDF conforme o escopo com design profissional
func (s *Service) GerarPDFVendas(resumo *ResumoVenda) (*gofpdf.Fpdf, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	tr := pdf.UnicodeTranslatorFromDescriptor("cp1252")
	pdf.AddPage()

	// 1. Cabeçalho
	periodo := fmt.Sprintf("%s a %s", resumo.PeriodoInicio.Format("02/01/2006"), resumo.PeriodoFim.Format("02/01/2006"))
	s.aplicarCabecalhoProfissional(pdf, "RELATÓRIO DE VENDAS", "Período: "+periodo)

	// 2. Cards de Resumo (KPIs de Fluxo de Caixa)
	// Ajustamos as larguras para caber 4 cards lado a lado
	const cardW = 44.0
	const cardGap = 3.0
	var curX = 15.0

	s.desenharCard(pdf, curX, 45, cardW, 22, tr("VALOR PRODUTOS"), formatarMoedaBRL(resumo.TotalProdutos), 100, 100, 100) // Cinza
	curX += cardW + cardGap
	s.desenharCard(pdf, curX, 45, cardW, 22, tr("TOTAL RECEBIDO"), formatarMoedaBRL(resumo.TotalRecebido), 10, 31, 68) // Azul
	curX += cardW + cardGap
	s.desenharCard(pdf, curX, 45, cardW, 22, tr("TROCO REALIZADO"), formatarMoedaBRL(resumo.TotalTrocoReal), 220, 53, 69) // Vermelho
	curX += cardW + cardGap
	s.desenharCard(pdf, curX, 45, cardW, 22, tr("RECEITA LÍQUIDA"), formatarMoedaBRL(resumo.ReceitaLiquida), 40, 167, 69) // Verde

	pdf.Ln(32)

	// 2.1 Bloco de Conciliação Financeira
	pdf.SetFont("Arial", "B", 13)
	pdf.SetFillColor(10, 31, 68)
	pdf.SetTextColor(255, 255, 255)
	pdf.CellFormat(185, 9, tr("CONCILIAÇÃO FINANCEIRA GERAL"), "0", 1, "C", true, 0, "")
	pdf.SetTextColor(0, 0, 0)
	pdf.SetFont("Arial", "", 10)
	pdf.Ln(2)

	colLabel := 115.0
	colVal := 70.0
	altLinha := 9.0 // Aumentada p/ respirar melhor

	pdf.CellFormat(colLabel, altLinha, tr("(+) Total Bruto Vendido (Valor Nominal das Mercadorias)"), "B", 0, "L", false, 0, "")
	pdf.CellFormat(colVal, altLinha, formatarMoedaBRL(resumo.TotalProdutos), "B", 1, "R", false, 0, "")

	pdf.CellFormat(colLabel, altLinha, tr("(+) Entradas em Caixa (O que os clientes entregaram para pagar)"), "B", 0, "L", false, 0, "")
	pdf.CellFormat(colVal, altLinha, formatarMoedaBRL(resumo.TotalRecebido), "B", 1, "R", false, 0, "")

	pdf.SetTextColor(200, 0, 0)
	pdf.CellFormat(colLabel, altLinha, tr("(-) Trocos Devolvidos (Saída real de dinheiro físico)"), "B", 0, "L", false, 0, "")
	pdf.CellFormat(colVal, altLinha, "- "+formatarMoedaBRL(resumo.TotalTrocoReal), "B", 1, "R", false, 0, "")
	pdf.SetTextColor(0, 0, 0)

	pdf.SetFont("Arial", "B", 11)
	pdf.SetFillColor(240, 240, 240)
	pdf.CellFormat(colLabel, altLinha+2, tr("(=) TOTAL LÍQUIDO NO CAIXA (Soma das Contas e Gaveta)"), "TB", 0, "L", true, 0, "")
	pdf.CellFormat(colVal, altLinha+2, formatarMoedaBRL(resumo.ReceitaLiquida), "TB", 1, "R", true, 0, "")
	pdf.SetFont("Arial", "", 10)

	pdf.Ln(8)

	// 3. Resumo por Status (SITUAÇÃO)
	pdf.SetFont("Arial", "B", 13)
	pdf.SetFillColor(230, 230, 230)
	pdf.CellFormat(185, 9, tr("RESUMO POR SITUAÇÃO (STATUS)"), "0", 1, "L", true, 0, "")
	pdf.Ln(2)

	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(92, 8, tr("Status da Venda"), "B", 0, "L", false, 0, "")
	pdf.CellFormat(93, 8, tr("Quantidade"), "B", 1, "R", false, 0, "")

	pdf.SetFont("Arial", "", 10)
	statusLabels := map[string]string{
		"concluida":   "Concluída",
		"pendente":    "Aguardando Pagamento / Pendente",
		"reembolsado": "Reembolsada / Devolvida",
		"cancelada":   "Cancelada",
	}

	for _, st := range []string{"concluida", "pendente", "reembolsado", "cancelada"} {
		qtd := resumo.PorStatus[st]
		label := statusLabels[st]
		pdf.CellFormat(92, 8, tr(label), "", 0, "L", false, 0, "")
		pdf.CellFormat(93, 8, fmt.Sprintf("%d", qtd), "", 1, "R", false, 0, "")
	}
	pdf.Ln(8)

	// 4. Detalhamento por Pagamento
	pdf.SetFont("Arial", "B", 13)
	pdf.SetFillColor(230, 230, 230)
	pdf.CellFormat(185, 9, tr("RESUMO FINANCEIRO POR PAGAMENTO"), "0", 1, "L", true, 0, "")
	pdf.Ln(2)

	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(92, 8, tr("Meio de Pagamento"), "B", 0, "L", false, 0, "")
	pdf.CellFormat(93, 8, tr("Valor Total"), "B", 1, "R", false, 0, "")

	pdf.SetFont("Arial", "", 10)
	zebra := false
	for _, tipo := range []string{"dinheiro", "pix", "credito", "debito", "sucata"} {
		valor, ok := resumo.PorPagamento[tipo]
		if !ok || valor == 0 { continue }
		
		if zebra { pdf.SetFillColor(249, 249, 249) } else { pdf.SetFillColor(255, 255, 255) }
		
		label := tipo
		switch tipo {
		case "dinheiro": label = "Dinheiro"
		case "pix": label = "Pix"
		case "credito": label = "Cartão de Crédito"
		case "debito": label = "Cartão de Débito"
		case "sucata": label = "Vale Sucata"
		}

		pdf.CellFormat(92, 9, tr(label), "", 0, "L", true, 0, "")
		pdf.CellFormat(93, 9, formatarMoedaBRL(valor), "", 1, "R", true, 0, "")
		zebra = !zebra
	}

	pdf.Ln(10)

	// 5. Detalhamento Analítico por Produto
	pdf.SetFont("Arial", "B", 13)
	pdf.SetFillColor(230, 230, 230)
	pdf.CellFormat(185, 9, tr("DETALHAMENTO ANALÍTICO DE VENDAS POR PRODUTO"), "0", 1, "C", true, 0, "")
	pdf.Ln(2)

	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(80, 8, tr("Produto"), "B", 0, "L", false, 0, "")
	pdf.CellFormat(30, 8, tr("Categoria"), "B", 0, "L", false, 0, "")
	pdf.CellFormat(30, 8, tr("Qtd"), "B", 0, "R", false, 0, "")
	pdf.CellFormat(45, 8, tr("Total Bruto"), "B", 1, "R", false, 0, "")

	pdf.SetFont("Arial", "", 8)
	zebra = false
	for _, vol := range resumo.Volumes {
		if zebra { pdf.SetFillColor(249, 249, 249) } else { pdf.SetFillColor(255, 255, 255) }
		pdf.CellFormat(80, 8, "  "+tr(vol.Produto), "", 0, "L", true, 0, "")
		pdf.CellFormat(30, 8, tr(vol.Categoria), "", 0, "L", true, 0, "")
		pdf.CellFormat(30, 8, fmt.Sprintf("%d un", vol.Quantidade), "", 0, "R", true, 0, "")
		pdf.CellFormat(45, 8, formatarMoedaBRL(vol.ValorTotal), "", 1, "R", true, 0, "")
		zebra = !zebra
	}

	pdf.SetY(-20)
	pdf.SetFont("Arial", "I", 8)
	pdf.SetTextColor(128, 128, 128)
	pdf.CellFormat(185, 10, tr(fmt.Sprintf("Relatório Gerencial - Documento emitido em %s - Página %d", time.Now().Format("02/01/2006 15:04"), pdf.PageNo())), "", 0, "C", false, 0, "")

	return pdf, nil
}

// SaldoEstoque detalha o saldo atual por produto e categoria
type SaldoEstoque struct {
	Produto   string `json:"produto"`
	Categoria string `json:"categoria"`
	Quantidade int    `json:"quantidade"`
}

// ResumoEstoque representa os dados atuais e históricos do estoque
type ResumoEstoque struct {
	PeriodoInicio       time.Time                               `json:"periodo_inicio"`
	PeriodoFim          time.Time                               `json:"periodo_fim"`
	TotalBaterias       int                                     `json:"total_baterias"`
	ValorTotal          float64                                 `json:"valor_total"`
	TotalSucataPeso     float64                                 `json:"total_sucata_peso"`
	TotalSucataValor    float64                                 `json:"total_sucata_valor"`
	TotalSucataQtd      int                                     `json:"total_sucata_qtd"`
	Saldos              []SaldoEstoque                          `json:"saldos"`
	StatusContagem      map[string]int                          `json:"status_contagem"`
	Movimentacoes       []movimentacao.Movimentacao             `json:"movimentacoes"`
	Sucatas             []sucata.EstoqueSucata                  `json:"sucatas"`
	MovimentacoesSucata []movimentacao_sucata.MovimentacaoSucata `json:"movimentacoes_sucata"`
}

// ObterDadosEstoque consolida o estado atual e o histórico do período selecionado
func (s *Service) ObterDadosEstoque(inicio, fim time.Time) (*ResumoEstoque, error) {
	loc, _ := time.LoadLocation("America/Sao_Paulo")
	// Lógica de período padrão se datas forem zeradas
	if inicio.IsZero() {
		agora := time.Now().In(loc)
		inicio = time.Date(agora.Year(), agora.Month(), 1, 0, 0, 0, 0, loc)
	} else {
		inicio = time.Date(inicio.Year(), inicio.Month(), inicio.Day(), 0, 0, 0, 0, loc)
	}
	
	if fim.IsZero() {
		agora := time.Now().In(loc)
		fim = time.Date(agora.Year(), agora.Month(), agora.Day(), 23, 59, 59, 999999999, loc)
	} else {
		fim = time.Date(fim.Year(), fim.Month(), fim.Day(), 23, 59, 59, 999999999, loc)
	}

	// 1. Estoque Geral (Todos os estados)
	var itens []estoque.ItemEstoque
	err := s.db.Preload("Produto").Find(&itens).Error
	if err != nil {
		return nil, err
	}

	resumo := &ResumoEstoque{
		PeriodoInicio:  inicio,
		PeriodoFim:     fim,
		StatusContagem: make(map[string]int),
	}

	mapSaldos := make(map[string]*SaldoEstoque)

	for _, i := range itens {
		// Conta o status no GERAL (para saber a saúde atual da prateleira)
		resumo.StatusContagem[i.Estado]++
		
		// Detalhamento de saldo (Apenas Disponíveis e Reservados)
		if i.Estado == "disponivel" || i.Estado == "reservado" {
			resumo.TotalBaterias++
			if i.Produto.ID != 0 {
				resumo.ValorTotal += i.Produto.ValorVarejo
				chave := fmt.Sprintf("%d", i.Produto.ID)
				
				if sld, ok := mapSaldos[chave]; ok {
					sld.Quantidade++
				} else {
					cat := i.Produto.Categoria
					if cat == "" { cat = "N/D" }
					mapSaldos[chave] = &SaldoEstoque{
						Produto:    i.Produto.Nome,
						Categoria:  cat,
						Quantidade: 1,
					}
				}
			}
		}
	}

	// AJUSTE: O campo "vendido" no StatusContagem deve respeitar o PERÍODO do filtro para o relatório fazer sentido.
	// Vamos sobrescrever a contagem total de 'vendido' pela contagem do período.
	var qtdVendidaNoPeriodo int64
	s.db.Model(&estoque.ItemEstoque{}).
		Where("estado = ? AND updated_at BETWEEN ? AND ?", "vendido", inicio, fim).
		Count(&qtdVendidaNoPeriodo)
	resumo.StatusContagem["vendido"] = int(qtdVendidaNoPeriodo)

	for _, sld := range mapSaldos {
		resumo.Saldos = append(resumo.Saldos, *sld)
	}

	// 2. Movimentações de Baterias do Período (com Usuário)
	var movs []movimentacao.Movimentacao
	s.db.Preload("Usuario").Where("data >= ? AND data <= ?", inicio, fim).Order("data desc").Find(&movs)
	resumo.Movimentacoes = movs

	// 3. Sucata Atual (Estado atual dos bags)
	var sucatasAtuais []sucata.EstoqueSucata
	s.db.Preload("Produto").Find(&sucatasAtuais)
	resumo.Sucatas = sucatasAtuais
	
	for _, sc := range sucatasAtuais {
		resumo.TotalSucataPeso += sc.Peso
		resumo.TotalSucataValor += sc.ValorTotal
	}
	resumo.TotalSucataQtd = len(sucatasAtuais)

	// 4. Movimentações de Sucata do Período
	var movsSucata []movimentacao_sucata.MovimentacaoSucata
	s.db.Preload("Usuario").Where("data >= ? AND data <= ?", inicio, fim).Order("data desc").Find(&movsSucata)
	resumo.MovimentacoesSucata = movsSucata

	return resumo, nil
}

// GerarPDFEstoque cria o documento PDF conforme o escopo com design profissional
func (s *Service) GerarPDFEstoque(resumo *ResumoEstoque) (*gofpdf.Fpdf, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	tr := pdf.UnicodeTranslatorFromDescriptor("cp1252")
	pdf.AddPage()
	
	// 1. Cabeçalho
	periodo := fmt.Sprintf("%s a %s", resumo.PeriodoInicio.Format("02/01/2006"), resumo.PeriodoFim.Format("02/01/2006"))
	s.aplicarCabecalhoProfissional(pdf, "RELATÓRIO DE ESTOQUE", "Período: "+periodo)

	// 2. Cards de Resumo (KPIs - Baterias Novas)
	const cardW = 92.5
	const cardGap = 3.0
	var curX = 15.0

	s.desenharCard(pdf, curX, 45, cardW, 22, tr("BATERIAS EM ESTOQUE"), fmt.Sprintf("%d unidades", resumo.TotalBaterias), 10, 31, 68) // Azul
	curX += cardW + cardGap
	s.desenharCard(pdf, curX, 45, cardW, 22, tr("VALOR TOTAL BATERIAS"), formatarMoedaBRL(resumo.ValorTotal), 40, 167, 69) // Verde

	pdf.Ln(35)

	// 3. Saldo Atual Detalhado (Estilo Sucata)
	pdf.SetFont("Arial", "B", 13)
	pdf.SetFillColor(10, 31, 68); pdf.SetTextColor(255, 255, 255)
	pdf.CellFormat(185, 9, tr("SALDO ATUAL EM PRATELEIRA (BATERIAS NOVAS)"), "0", 1, "C", true, 0, "")
	pdf.SetTextColor(0, 0, 0); pdf.Ln(2)

	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(95, 9, tr("Descrição do Produto"), "B", 0, "L", false, 0, "")
	pdf.CellFormat(45, 9, tr("Categoria (Ah)"), "B", 0, "L", false, 0, "") 
	pdf.CellFormat(45, 9, tr("Qtd em Estoque"), "B", 1, "R", false, 0, "")

	pdf.SetFont("Arial", "", 9)
	zebra := false
	for _, sld := range resumo.Saldos {
		if zebra { pdf.SetFillColor(249, 249, 249) } else { pdf.SetFillColor(255, 255, 255) }
		pdf.CellFormat(95, 8, "  "+tr(sld.Produto), "", 0, "L", true, 0, "")
		pdf.CellFormat(45, 8, tr(sld.Categoria), "", 0, "L", true, 0, "")
		pdf.CellFormat(45, 8, tr(fmt.Sprintf("%d un", sld.Quantidade)), "", 1, "R", true, 0, "")
		zebra = !zebra
	}
	pdf.Ln(8)

	// 3.1 Resumo de Saúde do Estoque (Status)
	pdf.SetFont("Arial", "B", 11)
	pdf.SetFillColor(240, 240, 240)
	pdf.CellFormat(185, 8, tr("SITUAÇÃO GERAL DOS ITENS"), "0", 1, "L", true, 0, "")
	pdf.SetFont("Arial", "", 9)
	pdf.Ln(2)
	
	colWStatus := 185.0 / 4.0
	statusLabels := map[string]string{
		"disponivel":  "Disponíveis",
		"reservado":   "Em Venda",
		"reembolsado": "Reembolsadas",
		"vendido":     "Vendidos (Período)",
	}
	
	for _, k := range []string{"disponivel", "reservado", "reembolsado", "vendido"} {
		label := statusLabels[k]
		count := resumo.StatusContagem[k]
		pdf.CellFormat(colWStatus, 7, tr(fmt.Sprintf("%s: %d", label, count)), "1", 0, "C", false, 0, "")
	}
	pdf.Ln(12)

	// 4. Movimentações de Baterias Novas
	pdf.SetFont("Arial", "B", 13)
	pdf.SetFillColor(230, 230, 230)
	pdf.CellFormat(185, 9, tr("HISTÓRICO DE MOVIMENTAÇÕES (DETALHADO)"), "0", 1, "L", true, 0, "")
	pdf.Ln(2)
	
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(10, 31, 68); pdf.SetTextColor(255, 255, 255)
	pdf.CellFormat(25, 9, tr("Data"), "1", 0, "C", true, 0, "")
	pdf.CellFormat(20, 9, tr("Tipo"), "1", 0, "C", true, 0, "")
	pdf.CellFormat(100, 9, tr("Motivo / Detalhes"), "1", 0, "L", true, 0, "")
	pdf.CellFormat(40, 9, tr("Operador"), "1", 1, "C", true, 0, "")

	pdf.SetTextColor(0, 0, 0); pdf.SetFont("Arial", "", 8)
	zebra = false
	for _, m := range resumo.Movimentacoes {
		if zebra { pdf.SetFillColor(245, 245, 245) } else { pdf.SetFillColor(255, 255, 255) }
		pdf.CellFormat(25, 8, m.Data.Format("02/01/06"), "1", 0, "C", true, 0, "")
		
		pdf.SetTextColor(40, 167, 69)
		tipo := "ENT"
		if m.Tipo == "saida" { tipo = "SAI"; pdf.SetTextColor(220, 53, 69) }
		pdf.CellFormat(20, 8, tr(tipo), "1", 0, "C", true, 0, "")
		
		pdf.SetTextColor(0, 0, 0)
		pdf.CellFormat(100, 8, " "+tr(m.Motivo), "1", 0, "L", true, 0, "")
		pdf.CellFormat(40, 8, tr(m.Usuario.Nome), "1", 1, "C", true, 0, "")
		zebra = !zebra
	}
	pdf.Ln(10)

	// --- SEÇÃO DE SUCATA ---
	pdf.AddPage() // Nova página para sucata para não ficar apertado
	periodoSec := fmt.Sprintf("%s a %s", resumo.PeriodoInicio.Format("02/01/06"), resumo.PeriodoFim.Format("02/01/06"))
	s.aplicarCabecalhoProfissional(pdf, "RELATÓRIO DE SUCATA", "Período: "+periodoSec)

	// 4.1 Cards de Resumo de Sucata (Agora com 3 cards nesta página)
	const cardScW = 60.0
	const cardScGap = 2.5
	var curScX = 15.0

	s.desenharCard(pdf, curScX, 45, cardScW, 22, tr("LOTES DE SUCATA"), fmt.Sprintf("%d", resumo.TotalSucataQtd), 10, 31, 68) // Azul
	curScX += cardScW + cardScGap
	s.desenharCard(pdf, curScX, 45, cardScW, 22, tr("PESO TOTAL SUCATAS"), fmt.Sprintf("%.2f kg", resumo.TotalSucataPeso), 255, 152, 0) // Laranja
	curScX += cardScW + cardScGap
	s.desenharCard(pdf, curScX, 45, cardScW, 22, tr("VALOR TOTAL SUCATAS"), formatarMoedaBRL(resumo.TotalSucataValor), 100, 100, 100) // Cinza

	pdf.Ln(35)

	// 5. Estoque de Sucata
	pdf.SetFont("Arial", "B", 13)
	pdf.SetFillColor(10, 31, 68); pdf.SetTextColor(255, 255, 255)
	pdf.CellFormat(185, 9, tr("ESTOQUE ATUAL DE SUCATAS (SÍNTESE)"), "0", 1, "C", true, 0, "")
	pdf.SetTextColor(0, 0, 0); pdf.Ln(2)

	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(60, 9, tr("Tipo de Bateria"), "B", 0, "L", false, 0, "") 
	pdf.CellFormat(25, 9, tr("Qtd"), "B", 0, "R", false, 0, "")
	pdf.CellFormat(30, 9, tr("Peso Total"), "B", 0, "R", false, 0, "")
	pdf.CellFormat(35, 9, tr("Preço / Kg"), "B", 0, "R", false, 0, "")
	pdf.CellFormat(35, 9, tr("Valor Total"), "B", 1, "R", false, 0, "")

	pdf.SetFont("Arial", "", 10)
	var totalGeralSucata float64
	zebra = false
	for _, sc := range resumo.Sucatas {
		if zebra { pdf.SetFillColor(249, 249, 249) } else { pdf.SetFillColor(255, 255, 255) }
		
		nomeExibicao := fmt.Sprintf("[%s] %s", sc.Produto.Categoria, sc.Produto.Nome)
		pdf.CellFormat(60, 9, tr(nomeExibicao), "B", 0, "L", true, 0, "")
		
		pdf.CellFormat(25, 9, "1 un", "B", 0, "R", true, 0, "")
		pdf.CellFormat(30, 9, fmt.Sprintf("%.2f kg", sc.Peso), "B", 0, "R", true, 0, "") 
		pdf.CellFormat(35, 9, formatarMoedaBRL(sc.PrecoPorKg), "B", 0, "R", true, 0, "")
		pdf.CellFormat(35, 9, formatarMoedaBRL(sc.ValorTotal), "B", 1, "R", true, 0, "")
		totalGeralSucata += sc.ValorTotal
		zebra = !zebra
	}
	
	pdf.SetFont("Arial", "B", 10); pdf.SetFillColor(240, 240, 240)
	pdf.CellFormat(150, 10, tr("VALOR TOTAL ESTIMADO EM SUCATA"), "1", 0, "R", true, 0, "")
	pdf.CellFormat(35, 10, formatarMoedaBRL(totalGeralSucata), "1", 1, "R", true, 0, "")
	pdf.Ln(8)

	// 6. Histórico de Movimentações de Sucata
	pdf.SetFont("Arial", "B", 13)
	pdf.SetFillColor(230, 230, 230)
	pdf.CellFormat(185, 9, tr("MOVIMENTAÇÕES DE SUCATA (MÊS ATUAL)"), "0", 1, "L", true, 0, "")
	pdf.Ln(2)

	pdf.SetFont("Arial", "B", 10)
	pdf.SetFillColor(10, 31, 68); pdf.SetTextColor(255, 255, 255)
	pdf.CellFormat(30, 9, tr("Data"), "1", 0, "C", true, 0, "")
	pdf.CellFormat(30, 9, tr("Tipo"), "1", 0, "C", true, 0, "")
	pdf.CellFormat(30, 9, tr("Peso"), "1", 0, "R", true, 0, "")
	pdf.CellFormat(95, 9, tr("Operador / Detalhes"), "1", 1, "L", true, 0, "")

	pdf.SetTextColor(0, 0, 0); pdf.SetFont("Arial", "", 9)
	zebra = false
	for _, m := range resumo.MovimentacoesSucata {
		if zebra { pdf.SetFillColor(245, 245, 245) } else { pdf.SetFillColor(255, 255, 255) }
		pdf.CellFormat(30, 8, m.Data.Format("02/01/06"), "1", 0, "C", true, 0, "")
		
		pdf.SetTextColor(40, 167, 69)
		tipo := "ENTRADA"
		if m.Tipo == "saida_sucata" { tipo = "SAÍDA"; pdf.SetTextColor(220, 53, 69) }
		pdf.CellFormat(30, 8, tr(tipo), "1", 0, "C", true, 0, "")
		
		pdf.SetTextColor(0, 0, 0)
		pdf.CellFormat(30, 8, fmt.Sprintf("%.2f kg", m.Peso), "1", 0, "R", true, 0, "")
		pdf.CellFormat(95, 8, " "+tr(m.Usuario.Nome), "1", 1, "L", true, 0, "")
		zebra = !zebra
	}

	pdf.SetY(-20)
	pdf.SetFont("Arial", "I", 8)
	pdf.SetTextColor(128, 128, 128)
	pdf.CellFormat(185, 10, tr(fmt.Sprintf("Relatório Gerencial de Inventário e Sucatas - Baterias SuperBR - Página %d", pdf.PageNo())), "", 0, "C", false, 0, "")

	return pdf, nil
}
