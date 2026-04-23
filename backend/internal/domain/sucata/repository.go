package sucata

import "gorm.io/gorm"

// Repository encapsula o acesso ao banco de dados para EstoqueSucata.
type Repository struct {
	db *gorm.DB
}

// NewRepository cria um novo Repository com a conexão injetada.
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// BuscarPorID retorna o registro de sucata pelo ID primário com o produto carregado.
func (r *Repository) BuscarPorID(id uint) (*EstoqueSucata, error) {
	var s EstoqueSucata
	result := r.db.Preload("Produto").First(&s, id)
	return &s, result.Error
}

// Listar retorna todos os lotes de sucata com os produtos correspondentes.
func (r *Repository) Listar() ([]EstoqueSucata, error) {
	var sucatas []EstoqueSucata
	// Ordenação por ID decrescente para mostrar entradas recentes primeiro
	result := r.db.Preload("Produto").Order("id desc").Find(&sucatas)
	return sucatas, result.Error
}

// Criar persiste um novo lote de sucata no banco de dados.
func (r *Repository) Criar(s *EstoqueSucata) error {
	return r.db.Create(s).Error
}

// Atualizar salva as alterações de um registro de sucata existente.
func (r *Repository) Atualizar(s *EstoqueSucata) error {
	return r.db.Save(s).Error
}

// Deletar remove fisicamente um lote do banco.
func (r *Repository) Deletar(s *EstoqueSucata) error {
	return r.db.Delete(s).Error
}

// DB expõe a conexão para uso em transações iniciadas no service.
func (r *Repository) DB() *gorm.DB {
	return r.db
}