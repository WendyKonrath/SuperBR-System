package sucata

import (
	"errors"
	"super-br/internal/domain/configuracao"
	"super-br/internal/domain/movimentacao_sucata"

	"gorm.io/gorm"
)

type Service struct {
	repo    *Repository
	movRepo *movimentacao_sucata.Repository
	config  *configuracao.Service
}

func NewService(repo *Repository, movRepo *movimentacao_sucata.Repository, config *configuracao.Service) *Service {
	return &Service{
		repo:    repo,
		movRepo: movRepo,
		config:  config,
	}
}

// Listar retorna todos os lotes de sucata.
func (s *Service) Listar() ([]EstoqueSucata, error) {
	return s.repo.Listar()
}

// BuscarPorID retorna um lote específico.
func (s *Service) BuscarPorID(id uint) (*EstoqueSucata, error) {
	return s.repo.BuscarPorID(id)
}

// EntradaSucata registra a chegada de unidades de sucata gerando um NOVO lote vinculado a um ProdutoID.
func (s *Service) EntradaSucata(produtoID uint, peso float64, vendaID *uint, usuarioID uint) (*EstoqueSucata, error) {
	if peso <= 0 {
		return nil, errors.New("peso de entrada deve ser maior que zero")
	}

	precoGlobal := s.config.GetPrecoSucataKg()
	sucata := &EstoqueSucata{
		ProdutoID:  produtoID,
		Peso:       peso,
		VendaID:    vendaID,
		PrecoPorKg: precoGlobal,
		ValorTotal: peso * precoGlobal,
		Estado:     "disponivel",
	}

	err := s.repo.DB().Transaction(func(tx *gorm.DB) error {
		if errCreate := tx.Create(sucata).Error; errCreate != nil {
			return errCreate
		}
		return s.movRepo.Registrar(tx, sucata.ID, usuarioID, "entrada_sucata", peso)
	})

	if err != nil {
		return nil, errors.New("erro ao registrar entrada de sucata")
	}

	return s.repo.BuscarPorID(sucata.ID)
}

// EditarLote atualiza o peso e estado do lote e cria registros de movimentação calculando a diferença matemática.
func (s *Service) EditarLote(id uint, novoPeso float64, novoProdutoID uint, novoVendaID *uint, novoEstado string, usuarioID uint) (*EstoqueSucata, error) {
	if novoPeso < 0 {
		return nil, errors.New("peso não pode ser negativo")
	}

	sucata, err := s.repo.BuscarPorID(id)
	if err != nil {
		return nil, errors.New("lote de sucata não encontrado")
	}

	err = s.repo.DB().Transaction(func(tx *gorm.DB) error {
		estadoAnterior := sucata.Estado
		pesoAnterior := sucata.Peso

		sucata.ProdutoID = novoProdutoID
		sucata.VendaID = novoVendaID
		sucata.Peso = novoPeso
		sucata.Estado = novoEstado
		
		sucata.ValorTotal = sucata.Peso * sucata.PrecoPorKg

		if err := tx.Save(sucata).Error; err != nil {
			return err
		}

		if novoEstado == "fora_de_estoque" && estadoAnterior == "disponivel" {
			return s.movRepo.Registrar(tx, sucata.ID, usuarioID, "saida_sucata", pesoAnterior)
		}

		delta := sucata.Peso - pesoAnterior
		if delta > 0 {
			return s.movRepo.Registrar(tx, sucata.ID, usuarioID, "entrada_sucata", delta)
		} else if delta < 0 {
			return s.movRepo.Registrar(tx, sucata.ID, usuarioID, "saida_sucata", -delta)
		}

		return nil
	})

	if err != nil {
		return nil, errors.New("erro ao editar saldo do lote")
	}

	return s.repo.BuscarPorID(sucata.ID)
}

func (s *Service) DeletarLote(id uint) error {
	sucata, err := s.repo.BuscarPorID(id)
	if err != nil {
		return err
	}
	return s.repo.Deletar(sucata)
}