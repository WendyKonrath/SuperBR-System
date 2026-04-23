package configuracao

import "gorm.io/gorm"

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Obter retorna a configuração atual ou cria a default caso a tabela esteja vazia.
func (r *Repository) Obter() Configuracao {
	var conf Configuracao
	if err := r.db.First(&conf, 1).Error; err != nil {
		conf = Configuracao{ID: 1, ValorSucata: 3.0, EstoqueMinimo: 5}
		r.db.Create(&conf)
	}
	return conf
}

// Salvar sobrescreve as propriedades do registro fixo.
func (r *Repository) Salvar(conf Configuracao) error {
	conf.ID = 1
	return r.db.Save(&conf).Error
}
