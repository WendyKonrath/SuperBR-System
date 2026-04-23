package movimentacao

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// Handler agrupa os endpoints HTTP do domínio de movimentação.
type Handler struct {
	service *Service
}

// NewHandler cria o handler com o service injetado.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// Listar retorna movimentações com filtros opcionais via query params.
// Sem filtro: retorna todas.
// ?tipo=entrada           → somente entradas
// ?tipo=saida             → somente saídas
// ?item_id=1              → movimentações de um item específico
// ?produto_id=1           → movimentações de todos os itens de um produto
// ?inicio=2025-01-01&fim=2025-01-31 → por período
// GET /api/movimentacoes
func (h *Handler) Listar(c *gin.Context) {
	var itemID, produtoID, usuarioID uint
	
	if val := c.Query("item_id"); val != "" {
		id, _ := strconv.ParseUint(val, 10, 32)
		itemID = uint(id)
	}
	if val := c.Query("produto_id"); val != "" {
		id, _ := strconv.ParseUint(val, 10, 32)
		produtoID = uint(id)
	}
	if val := c.Query("usuario_id"); val != "" {
		id, _ := strconv.ParseUint(val, 10, 32)
		usuarioID = uint(id)
	}

	tipo := c.Query("tipo")
	
	var inicio, fim *time.Time
	inicioStr := c.Query("inicio")
	fimStr := c.Query("fim")
	
	if inicioStr != "" && fimStr != "" {
		dIni, err1 := time.Parse("2006-01-02", inicioStr)
		dFim, err2 := time.Parse("2006-01-02", fimStr)
		if err1 == nil && err2 == nil {
			// Ajusta fim para o final do dia
			dFim = dFim.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
			inicio = &dIni
			fim = &dFim
		}
	}

	movs, err := h.service.ListarComFiltros(usuarioID, produtoID, itemID, tipo, inicio, fim)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": err.Error()})
		return
	}

	c.JSON(http.StatusOK, movs)
}