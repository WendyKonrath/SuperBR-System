package dashboard

import (
	"fmt"
	"super-br/internal/domain/estoque"
	"super-br/internal/domain/movimentacao"
	"super-br/internal/domain/venda"
	"time"
)

type Service struct {
	estoqueRepo *estoque.Repository
	vendaRepo   *venda.Repository
	movRepo     *movimentacao.Repository
}

func NewService(er *estoque.Repository, vr *venda.Repository, mr *movimentacao.Repository) *Service {
	return &Service{
		estoqueRepo: er,
		vendaRepo:   vr,
		movRepo:     mr,
	}
}

func (s *Service) ObterEstatisticas() (*Estatisticas, error) {
	stats := &Estatisticas{
		FluxoFinanceiro:     make([]FluxoMensal, 0),
		DistribuicaoEstoque: make([]ProdutoEstoque, 0),
		Alertas:             make([]Alerta, 0),
	}

	// 1. Métricas dos Cards
	resumos, err := s.estoqueRepo.ListarEstoque()
	totalDisponivel := 0
	valorTotalDisponivel := 0.0
	estoqueBaixo := 0
	
	if err == nil {
		for _, r := range resumos {
			totalDisponivel += r.QtdAtual 
			valorTotalDisponivel += r.ValorTotal
			if r.QtdAtual <= 5 {
				estoqueBaixo++
				stats.Alertas = append(stats.Alertas, Alerta{
					Nivel:    "critico",
					Mensagem: fmt.Sprintf("Estoque crítico: %s [%s] com apenas %d unidades.", r.Produto.Nome, r.Produto.Categoria, r.QtdAtual),
				})
			} else if r.QtdAtual <= 10 {
				stats.Alertas = append(stats.Alertas, Alerta{
					Nivel:    "aviso",
					Mensagem: fmt.Sprintf("Estoque baixo: %s [%s] tem apenas %d unidades.", r.Produto.Nome, r.Produto.Categoria, r.QtdAtual),
				})
			}
		}
	}

	hoje := time.Now().Truncate(24 * time.Hour)
	amanha := hoje.Add(24 * time.Hour)
	vendasHoje, _ := s.vendaRepo.ListarPorPeriodo(hoje, amanha)
	countVendas := 0
	for _, v := range vendasHoje {
		if v.Status == "concluida" {
			countVendas++
		}
	}

	stats.MetricasCards = MetricasCards{
		TotalEstoque: totalDisponivel,
		ValorTotal:   valorTotalDisponivel,
		EstoqueBaixo: estoqueBaixo,
		VendasDia:    countVendas,
	}

	// 2. Gráfico de Pizza (Distribuição por Produto)
	distMap := make(map[string]int)
	itens, err := s.estoqueRepo.ListarItens()
	if err == nil {
		for _, it := range itens {
			if it.Estado == "disponivel" || it.Estado == "reservado" {
				label := fmt.Sprintf("%s [%s]", it.Produto.Nome, it.Produto.Categoria)
				distMap[label]++
			}
		}
	}
	
	for label, qtd := range distMap {
		stats.DistribuicaoEstoque = append(stats.DistribuicaoEstoque, ProdutoEstoque{
			Label:      label,
			Quantidade: qtd,
		})
	}

	// 3. Gráfico Financeiro (Últimos 6 meses)
	for i := 5; i >= 0; i-- {
		target := time.Now().AddDate(0, -i, 0)
		mesNome := target.Format("Jan")
		
		inicioMes := time.Date(target.Year(), target.Month(), 1, 0, 0, 0, 0, time.Local)
		fimMes := inicioMes.AddDate(0, 1, 0)
		
		// Para o mês atual, o ponto final deve ser 'Agora', não o fim do mês futuro.
		// Isso sincroniza o gráfico com os Cards superiores.
		cutoffEstoque := fimMes
		if target.Month() == time.Now().Month() && target.Year() == time.Now().Year() {
			cutoffEstoque = time.Now()
		}

		// Receita de Vendas (Baseada no Valor Líquido Pago: Recebido - Troco)
		vendasMes, _ := s.vendaRepo.ListarPorPeriodo(inicioMes, fimMes)
		receita := 0.0
		for _, v := range vendasMes {
			if v.Status == "concluida" {
				totalRec := 0.0
				for _, p := range v.Pagamentos {
					totalRec += p.Valor
				}
				receita += (totalRec - v.TrocoDevolvido)
			}
		}

		// Investimento em Estoque (Patrimônio em Inventário ao Final do Mês ou Agora)
		// Lógica: Para cada item, encontramos o último movimento válido antes ou no 'cutoffEstoque'.
		// Se o último movimento for de 'entrada' ou 'disponibilidade', ele é contado.
		
		var mouts []struct {
			ItemID uint
			Tipo   string
			Data   time.Time
		}
		s.estoqueRepo.DB().Table("movimentacaos").
			Select("item_id, tipo, data").
			Where("data <= ?", cutoffEstoque).
			Order("item_id, data DESC").
			Scan(&mouts)

		// Mapa para guardar apenas o ÚLTIMO movimento de cada item antes do cutoff
		lastMovPerItem := make(map[uint]string)
		for _, m := range mouts {
			if _, exists := lastMovPerItem[m.ItemID]; !exists {
				lastMovPerItem[m.ItemID] = m.Tipo
			}
		}

		itensTotais, _ := s.estoqueRepo.ListarItens()
		investimento := 0.0
		for _, it := range itensTotais {
			if it.CreatedAt.After(cutoffEstoque) {
				continue
			}

			ultimoTipo, jaMoveu := lastMovPerItem[it.ID]
			
			// Se nunca moveu, mas foi criado antes, assumimos que está em estoque (entrada inicial).
			// Se moveu, verificamos se o último estado era de 'In' ou 'Out'.
			estaEmEstoque := false
			if !jaMoveu {
				estaEmEstoque = true
			} else {
				// Tipos que representam o item DENTRO do patrimônio da loja
				switch ultimoTipo {
				case "entrada", "disponivel", "reembolso", "reserva", "emprestimo":
					estaEmEstoque = true
				}
			}

			if estaEmEstoque {
				investimento += it.Produto.ValorAtacado
			}
		}

		stats.FluxoFinanceiro = append(stats.FluxoFinanceiro, FluxoMensal{
			Mes:            mesNome,
			ReceitaVendas:  receita,
			CustoReposicao: investimento,
		})
	}

	return stats, nil
}
