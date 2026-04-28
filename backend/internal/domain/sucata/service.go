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

// EntradaSucata registra a chegada de unidades de sucata gerando um NOVO lote.
// tx é opcional; se nil, usa a conexão padrão. estado é opcional; se vazio, usa "disponivel".
func (s *Service) EntradaSucata(tx *gorm.DB, produtoID *uint, descricao string, peso float64, vendaID *uint, usuarioID uint, estado string) (*EstoqueSucata, error) {
	if peso <= 0 {
		return nil, errors.New("peso de entrada deve ser maior que zero")
	}

	if produtoID == nil && descricao == "" {
		return nil, errors.New("informe o modelo ou uma descrição manual")
	}

	if estado == "" {
		estado = "disponivel"
	}

	if tx == nil {
		tx = s.repo.DB()
	}

	precoGlobal := s.config.GetPrecoSucataKg()
	sucata := &EstoqueSucata{
		ProdutoID:  produtoID,
		Descricao:  descricao,
		Peso:       peso,
		VendaID:    vendaID,
		PrecoPorKg: precoGlobal,
		ValorTotal: peso * precoGlobal,
		Estado:     estado,
	}

	err := tx.Transaction(func(itx *gorm.DB) error {
		if errCreate := itx.Create(sucata).Error; errCreate != nil {
			return errCreate
		}
		return s.movRepo.Registrar(itx, sucata.ID, usuarioID, "entrada_sucata", peso)
	})

	if err != nil {
		return nil, errors.New("erro ao registrar entrada de sucata: " + err.Error())
	}

	return sucata, nil
}

// EditarLote atualiza o peso e estado do lote e cria registros de movimentação.
func (s *Service) EditarLote(id uint, novoPeso float64, novoProdutoID *uint, novaDescricao string, novoVendaID *uint, novoEstado string, usuarioID uint) (*EstoqueSucata, error) {
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

		// Usamos SQL puro para garantir que o NULL seja processado corretamente pelo driver do banco
		err := tx.Exec("UPDATE estoque_sucatas SET produto_id = ?, descricao = ?, peso = ?, venda_id = ?, estado = ?, valor_total = ? WHERE id = ?", 
			novoProdutoID, novaDescricao, novoPeso, novoVendaID, novoEstado, novoPeso * sucata.PrecoPorKg, id).Error
		
		if err != nil {
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