package configuracao

// Configuracao encapsula as preferências e variáveis sistêmicas globais.
type Configuracao struct {
	ID            uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	ValorSucata   float64 `gorm:"type:decimal(10,2);not null;default:3.0" json:"valor_sucata"`
	EstoqueMinimo int     `gorm:"not null;default:5" json:"estoque_minimo"`
}

func (Configuracao) TableName() string {
	return "configuracoes_sistema"
}
