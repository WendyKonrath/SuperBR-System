package estoque

import (
	"errors"
	"fmt"
	"super-br/internal/domain/configuracao"
	"super-br/internal/domain/movimentacao"
	"super-br/internal/domain/notificacao"
	"super-br/internal/domain/produto"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Service contém a lógica de negócio do domínio de estoque.
type Service struct {
	repo         *Repository
	produtoRepo  *produto.Repository
	movRepo      *movimentacao.Repository
	notifService *notificacao.Service
	config       *configuracao.Service
}

// NewService cria o service injetando os repositórios necessários.
func NewService(
	repo *Repository,
	produtoRepo *produto.Repository,
	movRepo *movimentacao.Repository,
	notifService *notificacao.Service,
	config *configuracao.Service,
) *Service {
	return &Service{
		repo:         repo,
		produtoRepo:  produtoRepo,
		movRepo:      movRepo,
		notifService: notifService,
		config:       config,
	}
}

// SincronizarTodoEstoque é a ferramenta de "Auto-Cura" do sistema.
func (s *Service) SincronizarTodoEstoque() error {
	return s.repo.DB().Transaction(func(tx *gorm.DB) error {
		produtos, err := s.produtoRepo.Listar()
		if err != nil {
			return err
		}

		for _, p := range produtos {
			if err := s.SincronizarProduto(tx, p.ID); err != nil {
				return err
			}
		}
		return nil
	})
}

// SincronizarProduto recalcula o saldo aggregate de um único produto baseado nos seus itens individuais.
func (s *Service) SincronizarProduto(tx *gorm.DB, produtoID uint) error {
	var p produto.Produto
	if err := tx.Raw("SELECT * FROM produtos WHERE id = ?", produtoID).Scan(&p).Error; err != nil {
		return err
	}

	var itens []ItemEstoque
	if err := tx.Where("produto_id = ?", produtoID).Find(&itens).Error; err != nil {
		return err
	}

	var resumo Estoque
	if err := tx.Where("produto_id = ?", produtoID).First(&resumo).Error; err != nil {
		resumo = Estoque{ProdutoID: produtoID}
	}

	resumo.QtdAtual = 0
	resumo.QtdTotal = 0
	resumo.ValorTotal = 0

	for _, item := range itens {
		switch item.Estado {
		case "disponivel":
			resumo.QtdAtual++
			resumo.QtdTotal++
			resumo.ValorTotal += p.ValorAtacado
		case "emprestado", "reservado":
			resumo.QtdTotal++
			resumo.ValorTotal += p.ValorAtacado
		}
	}

	return tx.Save(&resumo).Error
}

// EntradaEstoque registra a chegada de uma ou mais baterias do mesmo lote.
func (s *Service) EntradaEstoque(produtoID uint, codLote string, quantidade int, usuarioID uint) error {
	p, err := s.produtoRepo.BuscarPorID(produtoID)
	if err != nil {
		return errors.New("produto não encontrado")
	}

	if quantidade <= 0 {
		quantidade = 1
	}

	return s.repo.DB().Transaction(func(tx *gorm.DB) error {
		for i := 0; i < quantidade; i++ {
			novoItem := &ItemEstoque{
				ProdutoID: produtoID,
				CodLote:   codLote,
				Estado:    "disponivel",
			}
			if err := tx.Create(novoItem).Error; err != nil {
				return err
			}

			// Registro de Movimentação Individual para Rastreabilidade Total
			if err := s.movRepo.Registrar(tx, novoItem.ID, usuarioID, "entrada", "Entrada de Lote"); err != nil {
				return err
			}
		}

		// Sincroniza o saldo consolidado apenas uma vez após criar todos os itens
		if err := s.SincronizarProduto(tx, produtoID); err != nil {
			return err
		}

		return s.notifService.NotificarEntradaEstoque(tx, p.Nome, codLote)
	})
}

// SaidaEstoque registra a baixa manual.
func (s *Service) SaidaEstoque(itemID uint, usuarioID uint) (*ItemEstoque, error) {
	var itemAtualizado *ItemEstoque
	err := s.repo.DB().Transaction(func(tx *gorm.DB) error {
		var item ItemEstoque
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&item, itemID).Error; err != nil {
			return errors.New("item não encontrado")
		}

		if item.Estado != "disponivel" {
			return errors.New("item não está disponível para baixa")
		}

		item.Estado = "indisponivel"
		tx.Save(&item)
		itemAtualizado = &item

		if err := s.SincronizarProduto(tx, item.ProdutoID); err != nil {
			return err
		}

		return s.movRepo.Registrar(tx, item.ID, usuarioID, "saida", "Baixa Manual")
	})

	return itemAtualizado, err
}

func (s *Service) DevolverItem(itemID uint, usuarioID uint) (*ItemEstoque, error) {
	var item *ItemEstoque
	err := s.repo.DB().Transaction(func(tx *gorm.DB) error {
		if err := tx.First(&item, itemID).Error; err != nil { return err }
		item.Estado = "disponivel"
		tx.Save(item)
		if err := s.movRepo.Registrar(tx, item.ID, usuarioID, "disponivel", "Retorno manual ao estoque"); err != nil {
			return err
		}
		return s.SincronizarProduto(tx, item.ProdutoID)
	})
	return item, err
}

func (s *Service) EmprestarItem(itemID uint, usuarioID uint) (*ItemEstoque, error) {
	var item *ItemEstoque
	err := s.repo.DB().Transaction(func(tx *gorm.DB) error {
		tx.First(&item, itemID)
		item.Estado = "emprestado"
		tx.Save(item)
		if err := s.movRepo.Registrar(tx, item.ID, usuarioID, "emprestimo", "Registro de Empréstimo"); err != nil {
			return err
		}
		return s.SincronizarProduto(tx, item.ProdutoID)
	})
	return item, err
}

func (s *Service) DevolverEmprestimo(itemID uint, usuarioID uint) (*ItemEstoque, error) {
	var item *ItemEstoque
	err := s.repo.DB().Transaction(func(tx *gorm.DB) error {
		tx.First(&item, itemID)
		item.Estado = "disponivel"
		tx.Save(item)
		if err := s.movRepo.Registrar(tx, item.ID, usuarioID, "disponivel", "Devolução de Empréstimo"); err != nil {
			return err
		}
		return s.SincronizarProduto(tx, item.ProdutoID)
	})
	return item, err
}

func (s *Service) EditarItem(itemID uint, novoProdutoID uint, novoCodLote string, novoEstado string, novaObs string, vendaID uint, usuarioID uint) (*ItemEstoque, error) {
	var item *ItemEstoque
	err := s.repo.DB().Transaction(func(tx *gorm.DB) error {
		if err := tx.First(&item, itemID).Error; err != nil { return err }
		oldPID := item.ProdutoID
		oldEstado := item.Estado
		item.ProdutoID, item.CodLote, item.Estado, item.Observacao = novoProdutoID, novoCodLote, novoEstado, novaObs
		tx.Save(item)

		// Lógica Especial: Vinculação/Troca de Venda Manual (SQL Puro para Garantia)
		if novoEstado == "vendido" || oldEstado == "vendido" || vendaID > 0 {
			// 1. Localizar vínculo ATIVO atual (se existir) para subsidiar as validações
			var vAntigaID uint
			var vAntigaValor float64
			var vAntigaStatus string
			tx.Raw("SELECT venda_id, valor_unitario, status FROM item_vendas WHERE item_estoque_id = ? AND status != 'reembolsado' LIMIT 1", item.ID).
				Row().Scan(&vAntigaID, &vAntigaValor, &vAntigaStatus)

			// 2. Validar venda de destino (se houver tentativa de vínculo)
			if vendaID > 0 {
				var vStatus string
				tx.Raw("SELECT status FROM vendas WHERE id = ?", vendaID).Scan(&vStatus)
				if vStatus == "" {
					return fmt.Errorf("venda #%d não encontrada no sistema", vendaID)
				}
				// REGRA: Impedir VINCULAR (vender) itens para vendas inválidas.
				// Mas PERMITIR editar o item se o objetivo for torná-lo disponível novamente.
				if novoEstado == "vendido" && (vStatus == "pendente" || vStatus == "cancelada" || vStatus == "reembolsado") {
					return fmt.Errorf("não é permitido vincular itens manualmente a vendas com status: %s. Apenas vendas CONCLUÍDAS permitem ajuste manual", vStatus)
				}

				// REGRA: Proibir troca direta de ID de venda se já estiver vendido
				if oldEstado == "vendido" && vAntigaID != 0 && vAntigaID != vendaID {
					return fmt.Errorf("não é permitido trocar o ID da venda diretamente. Mude o status para 'Disponível' primeiro para estornar a venda atual")
				}

				// REGRA: Exigir status 'disponivel' para nova vinculação
				if (vAntigaID == 0 || vAntigaStatus == "reembolsado") && oldEstado != "disponivel" {
					return fmt.Errorf("para vincular a uma venda, o item deve estar primeiro com o status 'Disponível'. Status atual: %s", oldEstado)
				}
			}

			// 3. Caso de SAÍDA: O item está saindo desta venda (indo para outra ou mudando de estado)
			// Forçamos o reembolso se o novo status não for 'vendido' OU se a venda destino for diferente.
			if vAntigaID != 0 && (vAntigaID != vendaID || novoEstado != "vendido") {
				tx.Exec("UPDATE vendas SET valor_total = valor_total - ? WHERE id = ?", vAntigaValor, vAntigaID)
				tx.Exec("UPDATE item_vendas SET status = 'reembolsado' WHERE item_estoque_id = ? AND venda_id = ?", item.ID, vAntigaID)
			}

			// 4. Caso de ENTRADA: O item está entrando ou re-entrando em uma venda
			// Apenas se o novo estado for orientado a venda ativa ('vendido')
			if vendaID > 0 && novoEstado == "vendido" {
				var vJaExistiuID uint
				var vJaExistiuStatus string
				var vJaExistiuValor float64
				tx.Raw("SELECT id, status, valor_unitario FROM item_vendas WHERE item_estoque_id = ? AND venda_id = ? LIMIT 1", item.ID, vendaID).
					Row().Scan(&vJaExistiuID, &vJaExistiuStatus, &vJaExistiuValor)

				if vJaExistiuID > 0 {
					if vJaExistiuStatus == "reembolsado" {
						// REATIVAÇÃO: O item já esteve aqui mas foi reembolsado. Voltamos ele e somamos o valor original.
						tx.Exec("UPDATE item_vendas SET status = 'vendido' WHERE id = ?", vJaExistiuID)
						tx.Exec("UPDATE vendas SET valor_total = valor_total + ? WHERE id = ?", vJaExistiuValor, vendaID)
					}
					// Se status == "vendido", o sistema não faz nada (idempotência).
				} else {
					// INSERÇÃO NOVA: Nunca esteve nesta venda.
					p, err := s.produtoRepo.BuscarPorID(novoProdutoID)
					if err != nil { return err }

					tx.Exec(`
						INSERT INTO item_vendas (venda_id, item_estoque_id, valor_unitario, quantidade, status, created_at) 
						VALUES (?, ?, ?, ?, ?, ?)`, 
						vendaID, item.ID, p.ValorVarejo, 1, "vendido", time.Now(),
					)
					tx.Exec("UPDATE vendas SET valor_total = valor_total + ? WHERE id = ?", p.ValorVarejo, vendaID)
				}
			}

			// 5. Registrar histórico de movimentação
			motivo := fmt.Sprintf("Ajuste de Vínculo (ID Venda: %d)", vendaID)
			if novoEstado != "vendido" { motivo = "Remoção de Venda / Reembolso" }
			if novaObs != "" { motivo += " - " + novaObs }
			s.movRepo.Registrar(tx, item.ID, usuarioID, novoEstado, motivo)
		} else if oldEstado != novoEstado {
			// Registro normal se não houver vinculação de venda
			motivo := "Alteração Manual de Status"
			if novaObs != "" { motivo = fmt.Sprintf("Ajuste Manual: %s", novaObs) }
			s.movRepo.Registrar(tx, item.ID, usuarioID, novoEstado, motivo)
		}

		s.SincronizarProduto(tx, oldPID)
		if oldPID != novoProdutoID { s.SincronizarProduto(tx, novoProdutoID) }
		return nil
	})
	return item, err
}

func (s *Service) ListarItensFiltrados(produtoID uint, estado string, inicio, fim string) ([]ItemEstoque, error) {
	return s.repo.ListarItensFiltrados(produtoID, estado, inicio, fim)
}

func (s *Service) ListarEstoque() ([]Estoque, error) { return s.repo.ListarEstoque() }
func (s *Service) ListarItens() ([]ItemEstoque, error) { return s.repo.ListarItens() }
func (s *Service) BuscarItemPorID(id uint) (*ItemEstoque, error) { return s.repo.BuscarItemPorID(id) }
func (s *Service) BuscarEstoquePorProduto(id uint) (*Estoque, error) { return s.repo.BuscarEstoquePorProduto(id) }
