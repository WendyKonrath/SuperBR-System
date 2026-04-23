package estoque

import (
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Repository encapsula o acesso ao banco de dados para ItemEstoque e Estoque.
type Repository struct {
	db *gorm.DB
}

// NewRepository cria um novo Repository com a conexão injetada.
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// DB expõe a conexão para uso em transações iniciadas no service.
func (r *Repository) DB() *gorm.DB {
	return r.db
}

// =====================
// ItemEstoque
// =====================

// CriarItem persiste um novo item de estoque no banco de dados.
func (r *Repository) CriarItem(item *ItemEstoque) error {
	return r.db.Create(item).Error
}

// popularVendaIDs preenche o campo VendaID (gorm:"-") buscando na tabela item_vendas.
func (r *Repository) popularVendaIDs(itens []ItemEstoque) {
	for i := range itens {
		var iv struct { 
			VendaID uint `gorm:"column:venda_id"`
		}
		r.db.Table("item_vendas").
			Select("venda_id").
			Where("item_estoque_id = ? AND status != 'reembolsado'", itens[i].ID).
			Order("id DESC").
			Limit(1).
			Scan(&iv)
		if iv.VendaID != 0 {
			vID := iv.VendaID
			itens[i].VendaID = &vID
		}
	}
}

// BuscarItemPorID retorna um item de estoque pelo ID, carregando o Produto associado.
func (r *Repository) BuscarItemPorID(id uint) (*ItemEstoque, error) {
	var item ItemEstoque
	result := r.db.Preload("Produto").First(&item, id)
	if result.Error == nil {
		r.popularVendaIDs([]ItemEstoque{item}) // Re-utiliza lógica
		// Note: No Go, passar um slice de um local não altera o objeto original se não for ponteiro.
		// Mas ItemEstoque na struct do repo é retornado como *pointer.
		// Corrigindo:
		var iv struct{ VendaID uint }
		r.db.Table("item_vendas").Select("venda_id").Where("item_estoque_id = ?", item.ID).Order("id DESC").Limit(1).Scan(&iv)
		if iv.VendaID != 0 {
			vID := iv.VendaID
			item.VendaID = &vID
		}
	}
	return &item, result.Error
}

// ListarItens retorna todos os itens de estoque cadastrados.
func (r *Repository) ListarItens() ([]ItemEstoque, error) {
	var itens []ItemEstoque
	result := r.db.Preload("Produto").Find(&itens)
	if result.Error == nil {
		r.popularVendaIDs(itens)
	}
	return itens, result.Error
}

// ListarItensFiltrados retorna itens de estoque com múltiplos filtros opcionais (produto, estado e período).
func (r *Repository) ListarItensFiltrados(produtoID uint, estado string, inicio, fim string) ([]ItemEstoque, error) {
	var itens []ItemEstoque
	query := r.db.Preload("Produto")

	if produtoID > 0 {
		query = query.Where("produto_id = ?", produtoID)
	}
	if estado != "" {
		query = query.Where("estado = ?", estado)
	}
	if inicio != "" {
		query = query.Where("created_at >= ?", inicio+" 00:00:00")
	}
	if fim != "" {
		query = query.Where("created_at <= ?", fim+" 23:59:59")
	}

	result := query.Find(&itens)
	if result.Error == nil {
		r.popularVendaIDs(itens)
	}
	return itens, result.Error
}

// AtualizarItem salva as alterações de um item de estoque existente.
func (r *Repository) AtualizarItem(item *ItemEstoque) error {
	return r.db.Save(item).Error
}

// BuscarItemDisponivel localiza o primeiro item disponível de um produto
// usando SELECT FOR UPDATE para evitar condição de corrida em vendas concorrentes.
// Deve ser chamado dentro de uma transação.
func (r *Repository) BuscarItemDisponivel(produtoID uint, tx *gorm.DB) (*ItemEstoque, error) {
	var item ItemEstoque
	result := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("produto_id = ? AND estado = ?", produtoID, "disponivel").
		First(&item)
	return &item, result.Error
}

// =====================
// Estoque (resumo por produto)
// =====================

// BuscarEstoquePorProduto retorna o resumo de estoque de um produto.
func (r *Repository) BuscarEstoquePorProduto(produtoID uint) (*Estoque, error) {
	var e Estoque
	result := r.db.Preload("Produto").Where("produto_id = ?", produtoID).First(&e)
	return &e, result.Error
}

// ListarEstoque retorna o resumo de estoque de todos os produtos.
func (r *Repository) ListarEstoque() ([]Estoque, error) {
	var estoques []Estoque
	result := r.db.Preload("Produto").Find(&estoques)
	return estoques, result.Error
}

// CriarEstoque persiste um novo resumo de estoque para um produto.
func (r *Repository) CriarEstoque(e *Estoque) error {
	return r.db.Create(e).Error
}

// AtualizarEstoque salva as alterações no resumo de estoque.
func (r *Repository) AtualizarEstoque(e *Estoque) error {
	return r.db.Save(e).Error
}