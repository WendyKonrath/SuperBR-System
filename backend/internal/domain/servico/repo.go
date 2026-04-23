package servico

import "gorm.io/gorm"

// Repository interage com a tabela de serviços.
type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Criar(s *Servico) error {
	return r.db.Create(s).Error
}

func (r *Repository) Listar() ([]Servico, error) {
	var servicos []Servico
	if err := r.db.Where("ativo = ?", true).Order("nome asc").Find(&servicos).Error; err != nil {
		return nil, err
	}
	return servicos, nil
}

func (r *Repository) BuscarPorID(id uint) (*Servico, error) {
	var s Servico
	if err := r.db.First(&s, id).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repository) Atualizar(s *Servico) error {
	return r.db.Save(s).Error
}

func (r *Repository) Deletar(id uint) error {
	return r.db.Model(&Servico{}).Where("id = ?", id).Update("ativo", false).Error
}

func (r *Repository) BuscarPorNome(nome string) (*Servico, error) {
	var s Servico
	result := r.db.Where("nome = ?", nome).Find(&s)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, nil // Não encontrou, retorna nil sem erro
	}
	return &s, nil
}
