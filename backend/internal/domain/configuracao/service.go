package configuracao

import (
	"gorm.io/gorm"
)

type Service struct {
	repo *Repository
	db   *gorm.DB // RAW DB actions to avoid circular dependencies with other domains
}

func NewService(repo *Repository, db *gorm.DB) *Service {
	return &Service{repo: repo, db: db}
}

// GetEstoqueMinimo retorna o limite global estabelecido.
func (s *Service) GetEstoqueMinimo() int {
	return s.repo.Obter().EstoqueMinimo
}

// GetPrecoSucataKg retorna o float de preço corrente da sucata.
func (s *Service) GetPrecoSucataKg() float64 {
	return s.repo.Obter().ValorSucata
}

// UpdateConfigs define novas configurações de sistema e realiza reflexão de forma silenciosa para o legado.
func (s *Service) UpdateConfigs(estoqueMinimo int, precoSucata float64) error {
	conf := s.repo.Obter()
	conf.EstoqueMinimo = estoqueMinimo
	conf.ValorSucata = precoSucata
	s.repo.Salvar(conf)

	// Cascade update to all scrap instantly. Avoid cyclic package usage by pushing it via direct SQL.
	s.db.Exec("UPDATE estoque_sucatas SET preco_por_kg = ?, valor_total = peso * ?", precoSucata, precoSucata)
	return nil
}
