package movimentacao_sucata

import (
	"time"

	"gorm.io/gorm"
)

// Repository encapsula o acesso ao banco de dados para MovimentacaoSucata.
type Repository struct {
	db *gorm.DB
}

// NewRepository cria um novo Repository com a conexão injetada.
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Registrar persiste uma nova movimentação de sucata dentro de uma transação existente.
// Deve sempre ser chamado com o tx da transação pai para garantir atomicidade.
func (r *Repository) Registrar(tx *gorm.DB, sucataID uint, usuarioID uint, tipo string, peso float64) error {
	mov := MovimentacaoSucata{
		SucataID:  sucataID,
		UsuarioID: usuarioID,
		Tipo:      tipo,
		Peso:      peso,
		Data:      time.Now(),
	}
	return tx.Create(&mov).Error
}

// sucataInfoRow é usado internamente para receber os dados do JOIN.
type sucataInfoRow struct {
	MovID     uint   `gorm:"column:mov_id"`
	SucataID  uint   `gorm:"column:sucata_id"`
	ProdutoID uint   `gorm:"column:produto_id"`
	Nome      string `gorm:"column:nome"`
	Categoria string `gorm:"column:categoria"`
}

// popularSucataInfo busca as informações da sucata via JOIN e preenche
// o campo SucataInfo de cada movimentação.
func (r *Repository) popularSucataInfo(movs []MovimentacaoSucata) ([]MovimentacaoSucata, error) {
	if len(movs) == 0 {
		return movs, nil
	}

	ids := make([]uint, len(movs))
	for i, m := range movs {
		ids[i] = m.ID
	}

	var rows []sucataInfoRow
	err := r.db.Raw(`
		SELECT
			ms.id            AS mov_id,
			es.id            AS sucata_id,
			p.id             AS produto_id,
			p.nome           AS nome,
			p.categoria      AS categoria
		FROM movimentacao_sucatas ms
		JOIN estoque_sucatas es ON es.id = ms.sucata_id
		JOIN produtos p ON p.id = es.produto_id
		WHERE ms.id IN ?
	`, ids).Scan(&rows).Error
	if err != nil {
		return movs, err
	}

	infoMap := make(map[uint]*SucataInfo, len(rows))
	for _, row := range rows {
		r := row
		infoMap[r.MovID] = &SucataInfo{
			SucataID:  r.SucataID,
			ProdutoID: r.ProdutoID,
			Nome:      r.Nome,
			Categoria: r.Categoria,
		}
	}

	for i := range movs {
		movs[i].SucataInfo = infoMap[movs[i].ID]
	}

	return movs, nil
}

// ListarTodas retorna todas as movimentações de sucata com usuário e dados da sucata carregados.
func (r *Repository) ListarTodas() ([]MovimentacaoSucata, error) {
	var movs []MovimentacaoSucata
	if err := r.db.Preload("Usuario").Order("data DESC").Find(&movs).Error; err != nil {
		return nil, err
	}
	return r.popularSucataInfo(movs)
}

// ListarPorSucata retorna o histórico de movimentações de um tipo de sucata específico.
func (r *Repository) ListarPorSucata(sucataID uint) ([]MovimentacaoSucata, error) {
	var movs []MovimentacaoSucata
	if err := r.db.Preload("Usuario").
		Where("sucata_id = ?", sucataID).
		Order("data DESC").
		Find(&movs).Error; err != nil {
		return nil, err
	}
	return r.popularSucataInfo(movs)
}

// ListarPorTipo retorna movimentações filtradas por tipo.
func (r *Repository) ListarPorTipo(tipo string) ([]MovimentacaoSucata, error) {
	var movs []MovimentacaoSucata
	if err := r.db.Preload("Usuario").
		Where("tipo = ?", tipo).
		Order("data DESC").
		Find(&movs).Error; err != nil {
		return nil, err
	}
	return r.popularSucataInfo(movs)
}

// ListarPorPeriodo retorna movimentações dentro de um intervalo de datas.
func (r *Repository) ListarPorPeriodo(inicio, fim time.Time) ([]MovimentacaoSucata, error) {
	var movs []MovimentacaoSucata
	if err := r.db.Preload("Usuario").
		Where("data BETWEEN ? AND ?", inicio, fim).
		Order("data DESC").
		Find(&movs).Error; err != nil {
		return nil, err
	}
	return r.popularSucataInfo(movs)
}

// ListarComFiltros executa uma busca dinâmica de movimentações de sucata.
func (r *Repository) ListarComFiltros(uID, sID uint, tipo string, pMin, pMax float64, inicio, fim *time.Time) ([]MovimentacaoSucata, error) {
	query := r.db.Preload("Usuario")

	if uID != 0 {
		query = query.Where("usuario_id = ?", uID)
	}
	if sID != 0 {
		query = query.Where("sucata_id = ?", sID)
	}
	if tipo != "" {
		query = query.Where("tipo = ?", tipo)
	}
	if pMin > 0 {
		query = query.Where("peso >= ?", pMin)
	}
	if pMax > 0 {
		query = query.Where("peso <= ?", pMax)
	}
	if inicio != nil && fim != nil {
		query = query.Where("data BETWEEN ? AND ?", inicio, fim)
	}

	var movs []MovimentacaoSucata
	if err := query.Order("data DESC").Find(&movs).Error; err != nil {
		return nil, err
	}
	return r.popularSucataInfo(movs)
}