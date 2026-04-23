package venda

import (
	"errors"
	"fmt"
	"super-br/internal/domain/estoque"
	"super-br/internal/domain/movimentacao"
	"super-br/internal/domain/notificacao"
	"super-br/internal/domain/produto"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// itemInput representa um item a ser incluído na venda.
type itemInput struct {
	ProdutoID uint
	TipoPreco string
	CodLote   string
}

// servicoInput representa um serviço a ser incluído na venda.
type servicoInput struct {
	ServicoID    uint
	ValorCobrado float64
	Quantidade   int
}

// pagamentoInput representa uma forma de pagamento registrada na venda.
type pagamentoInput struct {
	Tipo  string
	Valor float64
}

// Service contém a lógica de negócio do domínio de vendas.
type Service struct {
	repo         *Repository
	estoqueRepo  *estoque.Repository
	produtoRepo  *produto.Repository
	movRepo      *movimentacao.Repository
	notifService *notificacao.Service
	estoqueServ  *estoque.Service
}

// NewService cria o service injetando todos os repositórios necessários.
func NewService(
	repo *Repository,
	estoqueRepo *estoque.Repository,
	produtoRepo *produto.Repository,
	movRepo *movimentacao.Repository,
	notifService *notificacao.Service,
	estoqueServ *estoque.Service,
) *Service {
	return &Service{
		repo:         repo,
		estoqueRepo:  estoqueRepo,
		produtoRepo:  produtoRepo,
		movRepo:      movRepo,
		notifService: notifService,
		estoqueServ:  estoqueServ,
	}
}

func (s *Service) preencherValorPago(v *Venda) {
	if v == nil { return }
	var totalRecebido float64
	for _, p := range v.Pagamentos {
		totalRecebido += p.Valor
	}
	
	// O Valor Pago real (líquido) que fica no caixa é: Total Recebido - Troco Efetivamente Devolvido
	v.ValorPago = totalRecebido - v.TrocoDevolvido

	// Se a venda foi cancelada, o valor pago deve ser zero na visualização
	if v.Status == StatusCancelada {
		v.ValorPago = 0
	}
	
	// Troco Sugerido (Cálculo apenas para auxílio visual baseado no total da venda)
	if totalRecebido > v.ValorTotal {
		v.Troco = totalRecebido - v.ValorTotal
	} else {
		v.Troco = 0
	}
}

// CriarVenda: Lógica Atômica Completa
func (s *Service) CriarVenda(
	nomeCliente, empresa, documentoCliente, telefoneCliente, observacoes string,
	itens []itemInput,
	servicos []servicoInput,
	pagamentos []pagamentoInput,
	usuarioID uint,
	trocoDevolvido float64,
) (*Venda, error) {
	if len(itens) == 0 && len(servicos) == 0 {
		return nil, errors.New("a venda deve conter ao menos um item ou serviço")
	}

	var vendaCriada *Venda
	err := s.repo.DB().Transaction(func(tx *gorm.DB) error {
		var valorTotal float64
		produtosEnvolvidos := make(map[uint]bool)
		
		// 1. Criar cabeçalho da venda
		novaVenda := &Venda{
			Data:             time.Now(),
			NomeCliente:      nomeCliente,
			Empresa:          empresa,
			DocumentoCliente: documentoCliente,
			TelefoneCliente:  telefoneCliente,
			Observacoes:      observacoes,
			Status:           StatusPendente,
			UsuarioID:        &usuarioID,
			TrocoDevolvido:   trocoDevolvido,
		}
		if err := tx.Create(novaVenda).Error; err != nil { return err }

		// 2. Processar itens
		for _, input := range itens {
			p, err := s.produtoRepo.BuscarPorID(input.ProdutoID)
			if err != nil { return fmt.Errorf("produto %d não encontrado", input.ProdutoID) }

			var itemEstoque estoque.ItemEstoque
			q := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where("produto_id = ? AND estado = ?", input.ProdutoID, "disponivel")
			if input.CodLote != "" { q = q.Where("cod_lote = ?", input.CodLote) }
			
			if err := q.First(&itemEstoque).Error; err != nil {
				return fmt.Errorf("sem estoque para %s", p.Nome)
			}

			itemEstoque.Estado = "reservado"
			if err := tx.Save(&itemEstoque).Error; err != nil { return err }

			// Registro de reserva no histórico
			s.movRepo.Registrar(tx, itemEstoque.ID, usuarioID, "reserva", "Reserva: Venda #"+fmt.Sprint(novaVenda.ID))

			valorUnit := p.ValorVarejo
			if input.TipoPreco == "atacado" { valorUnit = p.ValorAtacado }

			itv := &ItemVenda{
				VendaID:       novaVenda.ID,
				ItemEstoqueID: itemEstoque.ID,
				ValorUnitario: valorUnit,
				Quantidade:    1,
				Status:        "vendido",
			}
			if err := tx.Create(itv).Error; err != nil { return err }
			
			valorTotal += valorUnit
			produtosEnvolvidos[input.ProdutoID] = true
		}

		// 2.5 Processar serviços
		for _, sInput := range servicos {
			its := &ItemServicoVenda{
				VendaID:      novaVenda.ID,
				ServicoID:    sInput.ServicoID,
				ValorCobrado: sInput.ValorCobrado,
				Quantidade:   sInput.Quantidade,
			}
			if err := tx.Create(its).Error; err != nil { return err }
			valorTotal += (sInput.ValorCobrado * float64(sInput.Quantidade))
		}

		// 3. Processar pagamentos
		for _, pgInput := range pagamentos {
			pg := &Pagamento{
				VendaID: novaVenda.ID,
				Tipo:    pgInput.Tipo,
				Valor:   pgInput.Valor,
			}
			if err := tx.Create(pg).Error; err != nil { return err }
		}

		// 4. Atualizar total da venda
		novaVenda.ValorTotal = valorTotal
		if err := tx.Save(novaVenda).Error; err != nil { return err }

		// 5. Sincronizar saldos físicos
		for pID := range produtosEnvolvidos {
			if err := s.estoqueServ.SincronizarProduto(tx, pID); err != nil { return err }
		}

		vendaCriada = novaVenda
		return nil
	})

	if err != nil { return nil, err }
	return s.repo.BuscarPorID(vendaCriada.ID)
}

// AtualizarVenda: Reset Físico Total
func (s *Service) AtualizarVenda(
	vendaID uint,
	nomeCliente, empresa, documentoCliente, telefoneCliente, observacoes string,
	itens []itemInput,
	servicos []servicoInput,
	pagamentos []pagamentoInput,
	usuarioID uint,
	trocoDevolvido float64,
) (*Venda, error) {
	err := s.repo.DB().Transaction(func(tx *gorm.DB) error {
		var v Venda
		if err := tx.Preload("Itens.ItemEstoque").Preload("Servicos").First(&v, vendaID).Error; err != nil {
			return errors.New("venda não encontrada")
		}

		if v.Status != StatusPendente {
			return errors.New("somente vendas pendentes podem ser editadas")
		}

		produtosParaSincronizar := make(map[uint]bool)

		// 1. Liberar itens atuais de volta ao estoque
		for _, itv := range v.Itens {
			var ie estoque.ItemEstoque
			if err := tx.First(&ie, itv.ItemEstoqueID).Error; err == nil {
				ie.Estado = "disponivel"
				tx.Save(&ie)
				produtosParaSincronizar[ie.ProdutoID] = true
			}
		}

		// 2. Limpar tabelas associativas
		tx.Where("venda_id = ?", vendaID).Delete(&ItemVenda{})
		tx.Where("venda_id = ?", vendaID).Delete(&ItemServicoVenda{})
		tx.Where("venda_id = ?", vendaID).Delete(&Pagamento{})

		// 3. Reservar novos itens e calcular valor total
		var novoValorTotal float64
		for _, input := range itens {
			p, err := s.produtoRepo.BuscarPorID(input.ProdutoID)
			if err != nil { return err }

			var ie estoque.ItemEstoque
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where("produto_id = ? AND estado = ?", input.ProdutoID, "disponivel").
				First(&ie).Error; err != nil {
				return fmt.Errorf("estoque insuficiente: %s", p.Nome)
			}

			ie.Estado = "reservado"
			tx.Save(&ie)
			produtosParaSincronizar[input.ProdutoID] = true

			// Registro de reserva no histórico (Edição de Venda)
			s.movRepo.Registrar(tx, ie.ID, usuarioID, "reserva", "Reserva (Edição): Venda #"+fmt.Sprint(vendaID))

			vlr := p.ValorVarejo
			if input.TipoPreco == "atacado" { vlr = p.ValorAtacado }

			tx.Create(&ItemVenda{
				VendaID: vendaID, ItemEstoqueID: ie.ID,
				ValorUnitario: vlr, Quantidade: 1,
			})
			novoValorTotal += vlr
		}

		// 3.5. Salvar novos serviços
		for _, sInput := range servicos {
			if err := tx.Create(&ItemServicoVenda{
				VendaID:      vendaID,
				ServicoID:    sInput.ServicoID,
				ValorCobrado: sInput.ValorCobrado,
				Quantidade:   sInput.Quantidade,
			}).Error; err != nil {
				return err
			}
			novoValorTotal += (sInput.ValorCobrado * float64(sInput.Quantidade))
		}

		// 4. Salvar novos pagamentos
		for _, pg := range pagamentos {
			tx.Create(&Pagamento{VendaID: vendaID, Tipo: pg.Tipo, Valor: pg.Valor})
		}

		// 5. Atualizar cabeçalho
		v.NomeCliente, v.Empresa, v.DocumentoCliente, v.TelefoneCliente = nomeCliente, empresa, documentoCliente, telefoneCliente
		v.Observacoes, v.ValorTotal, v.TrocoDevolvido = observacoes, novoValorTotal, trocoDevolvido
		v.Itens = nil // Evita re-associação indevida no Save
		v.Servicos = nil // Evita re-associação indevida no Save
		tx.Save(&v)

		// 6. Sincronização Física Final
		for pID := range produtosParaSincronizar {
			s.estoqueServ.SincronizarProduto(tx, pID)
		}

		return nil
	})

	if err != nil { return nil, err }
	return s.repo.BuscarPorID(vendaID)
}

func (s *Service) ConfirmarVenda(vendaID, usuarioID uint) (*Venda, error) {
	err := s.repo.DB().Transaction(func(tx *gorm.DB) error {
		var v Venda
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Preload("Itens").First(&v, vendaID).Error; err != nil {
			return err
		}
		
		prodIDs := make(map[uint]bool)
		for _, it := range v.Itens {
			var ie estoque.ItemEstoque
			if err := tx.First(&ie, it.ItemEstoqueID).Error; err != nil { return err }
			ie.Estado = "vendido"
			tx.Save(&ie)
			prodIDs[ie.ProdutoID] = true
			s.movRepo.Registrar(tx, ie.ID, usuarioID, "vendido", "Venda #"+fmt.Sprint(v.ID))
		}
		v.Status = StatusConcluida
		tx.Save(&v)
		for pid := range prodIDs { s.estoqueServ.SincronizarProduto(tx, pid) }
		return s.notifService.NotificarVendaRealizada(tx, v.ID, v.NomeCliente, v.ValorTotal)
	})
	if err != nil { return nil, err }
	return s.repo.BuscarPorID(vendaID)
}

func (s *Service) CancelarVenda(vendaID, usuarioID uint) (*Venda, error) {
	err := s.repo.DB().Transaction(func(tx *gorm.DB) error {
		var v Venda
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Preload("Itens").First(&v, vendaID).Error; err != nil {
			return err
		}
		if v.Status != StatusPendente { return errors.New("somente vendas pendentes podem ser canceladas") }

		prodIDs := make(map[uint]bool)
		for _, it := range v.Itens {
			var ie estoque.ItemEstoque
			if err := tx.First(&ie, it.ItemEstoqueID).Error; err != nil { return err }
			ie.Estado = "disponivel"
			tx.Save(&ie)
			prodIDs[ie.ProdutoID] = true
			s.movRepo.Registrar(tx, ie.ID, usuarioID, "entrada", "Cancelamento Venda #"+fmt.Sprint(v.ID))
		}
		v.Status = StatusCancelada
		tx.Save(&v)
		for pid := range prodIDs { s.estoqueServ.SincronizarProduto(tx, pid) }
		return nil
	})
	if err != nil { return nil, err }
	return s.repo.BuscarPorID(vendaID)
}

// Métodos de consulta simples
func (s *Service) BuscarPorID(id uint) (*Venda, error) {
	v, err := s.repo.BuscarPorID(id)
	if err != nil { return nil, err }
	s.preencherValorPago(v)
	return v, nil
}
func (s *Service) ListarTodas() ([]Venda, error) {
	vendas, err := s.repo.ListarTodas()
	if err == nil { for i := range vendas { s.preencherValorPago(&vendas[i]) } }
	return vendas, err
}
func (s *Service) ListarPorStatus(st string) ([]Venda, error) {
	vendas, err := s.repo.ListarPorStatus(st)
	if err == nil { for i := range vendas { s.preencherValorPago(&vendas[i]) } }
	return vendas, err
}
func (s *Service) ListarPorPeriodo(in, fi time.Time) ([]Venda, error) {
	vendas, err := s.repo.ListarPorPeriodo(in, fi)
	if err == nil { for i := range vendas { s.preencherValorPago(&vendas[i]) } }
	return vendas, err
}
func (s *Service) AtualizarObservacoes(vID uint, obs string) (*Venda, error) {
	if err := s.repo.DB().Model(&Venda{}).Where("id = ?", vID).Update("observacoes", obs).Error; err != nil { return nil, err }
	return s.BuscarPorID(vID)
}
func (s *Service) DevolverVenda(vID, uID uint) (*Venda, error) {
	err := s.repo.DB().Transaction(func(tx *gorm.DB) error {
		var v Venda
		if err := tx.Preload("Itens").First(&v, vID).Error; err != nil { return err }
		for _, it := range v.Itens {
			var ie estoque.ItemEstoque
			if err := tx.First(&ie, it.ItemEstoqueID).Error; err == nil {
				ie.Estado = "reembolsado"
				tx.Save(&ie)
				s.estoqueServ.SincronizarProduto(tx, ie.ProdutoID)
				
				// Registro de reembolso no histórico
				s.movRepo.Registrar(tx, ie.ID, uID, "reembolso", "Devolução: Venda #"+fmt.Sprint(vID))
			}
		}
		v.Status = StatusReembolsado; tx.Save(&v)
		return nil
	})
	if err != nil { return nil, err }
	return s.BuscarPorID(vID)
}
