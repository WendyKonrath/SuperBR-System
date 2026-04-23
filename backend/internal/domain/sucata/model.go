package sucata

import (
	"super-br/internal/domain/produto"
	"time"
)

// EstoqueSucata representa o estoque consolidado de sucata de um tipo de bateria.
// Agora vinculado diretamente a um Produto do catálogo para evitar erros de texto.
type EstoqueSucata struct {
	ID         uint            `gorm:"primaryKey;autoIncrement" json:"id"`
	ProdutoID  uint            `gorm:"not null" json:"produto_id"`
	Produto    produto.Produto `gorm:"foreignKey:ProdutoID" json:"produto,omitempty"`
	Peso       float64         `gorm:"type:decimal(10,2);not null;default:0" json:"peso"`
	PrecoPorKg float64         `gorm:"type:decimal(10,2);not null;default:3.0" json:"preco_por_kg"`
	ValorTotal float64         `gorm:"type:decimal(10,2);not null;default:0" json:"valor_total"`
	Estado     string          `gorm:"type:varchar(30);not null;default:'disponivel'" json:"estado"`
	VendaID    *uint           `gorm:"index" json:"venda_id"`
	CreatedAt  time.Time       `json:"created_at"`
}

func (EstoqueSucata) TableName() string {
	return "estoque_sucatas"
}