package servico

import (
	"errors"
	"super-br/internal/domain/notificacao"
)

type Service struct {
	repo         *Repository
	notifService *notificacao.Service
}

func NewService(repo *Repository, notifService *notificacao.Service) *Service {
	return &Service{
		repo:         repo,
		notifService: notifService,
	}
}

func (s *Service) Criar(nome string, valor float64) (*Servico, error) {
	if valor < 0 {
		return nil, errors.New("o valor do serviço não pode ser negativo")
	}

	existente, _ := s.repo.BuscarPorNome(nome)
	if existente != nil {
		if existente.Ativo {
			return nil, errors.New("já existe um serviço com este nome")
		}
		// Reativa o serviço inativo
		existente.Ativo = true
		existente.Valor = valor
		if err := s.repo.Atualizar(existente); err != nil {
			return nil, errors.New("erro ao reativar serviço existente")
		}
		return existente, nil
	}

	novo := &Servico{
		Nome:  nome,
		Valor: valor,
		Ativo: true,
	}

	if err := s.repo.Criar(novo); err != nil {
		return nil, errors.New("erro ao criar serviço")
	}

	return novo, nil
}

func (s *Service) Listar() ([]Servico, error) {
	return s.repo.Listar()
}

func (s *Service) BuscarPorID(id uint) (*Servico, error) {
	servico, err := s.repo.BuscarPorID(id)
	if err != nil {
		return nil, errors.New("serviço não encontrado")
	}
	return servico, nil
}

func (s *Service) Atualizar(id uint, nome string, valor float64, usuarioNome string) (*Servico, error) {
	servico, err := s.repo.BuscarPorID(id)
	if err != nil {
		return nil, errors.New("serviço não encontrado")
	}

	if valor < 0 {
		return nil, errors.New("o valor do serviço não pode ser negativo")
	}

	existente, _ := s.repo.BuscarPorNome(nome)
	if existente != nil && existente.ID != id {
		return nil, errors.New("já existe outro serviço com este nome")
	}

	houveAlteracao := false
	if servico.Nome != nome || servico.Valor != valor {
		houveAlteracao = true
	}

	servico.Nome = nome
	servico.Valor = valor

	if err := s.repo.Atualizar(servico); err != nil {
		return nil, errors.New("erro ao atualizar serviço")
	}

	// Dispara notificação se houve mudança no nome ou valor
	if houveAlteracao {
		// Envia notificação assíncrona ou síncrona. Aqui fazemos síncrono.
		// tx = nil pois não estamos em transação obrigatória aqui.
		s.notifService.NotificarModificacaoServico(nil, servico.Nome, usuarioNome)
	}

	return servico, nil
}

func (s *Service) Deletar(id uint) error {
	_, err := s.repo.BuscarPorID(id)
	if err != nil {
		return errors.New("serviço não encontrado")
	}

	// NOTA: Para implementar a "Deleção Inteligente" (bloquear se o serviço já foi usado),
	// precisamos checar a tabela de vendas (item_servico_vendas). Faremos isso depois
	// de criar a estrutura em 'venda'. Por enquanto, permite deletar.
	
	return s.repo.Deletar(id)
}
