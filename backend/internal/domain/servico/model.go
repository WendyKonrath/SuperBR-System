package servico

import "time"

// Servico representa um serviço prestado pela loja (ex: Carga de Bateria).
type Servico struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Nome      string    `gorm:"type:varchar(100);not null" json:"nome"`
	Valor     float64   `gorm:"type:decimal(10,2);not null" json:"valor"`
	Ativo     bool      `gorm:"default:true" json:"ativo"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
