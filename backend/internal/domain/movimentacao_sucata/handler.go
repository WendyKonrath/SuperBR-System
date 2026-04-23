package movimentacao_sucata

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// Handler agrupa os endpoints HTTP do domínio de movimentação de sucata.
type Handler struct {
	service *Service
}

// NewHandler cria o handler com o service injetado.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// Listar retorna movimentações de sucata com filtros opcionais via query params.
// Sem filtro: retorna todas.
// ?tipo=entrada_sucata       → somente entradas
// ?tipo=saida_sucata         → somente saídas
// ?sucata_id=1               → movimentações de um tipo de sucata específico
// ?inicio=2025-01-01&fim=2025-01-31 → por período
// GET /api/movimentacoes/sucata
func (h *Handler) Listar(c *gin.Context) {
	var sucataID, usuarioID uint
	var pMin, pMax float64
	
	if val := c.Query("sucata_id"); val != "" {
		id, _ := strconv.ParseUint(val, 10, 32)
		sucataID = uint(id)
	}
	if val := c.Query("usuario_id"); val != "" {
		id, _ := strconv.ParseUint(val, 10, 32)
		usuarioID = uint(id)
	}
	if val := c.Query("peso_min"); val != "" {
		pMin, _ = strconv.ParseFloat(val, 64)
	}
	if val := c.Query("peso_max"); val != "" {
		pMax, _ = strconv.ParseFloat(val, 64)
	}

	tipo := c.Query("tipo")
	
	var inicio, fim *time.Time
	inicioStr := c.Query("inicio")
	fimStr := c.Query("fim")
	
	if inicioStr != "" && fimStr != "" {
		dIni, err1 := time.Parse("2006-01-02", inicioStr)
		dFim, err2 := time.Parse("2006-01-02", fimStr)
		if err1 == nil && err2 == nil {
			dFim = dFim.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
			inicio = &dIni
			fim = &dFim
		}
	}

	movs, err := h.service.ListarComFiltros(usuarioID, sucataID, tipo, pMin, pMax, inicio, fim)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": err.Error()})
		return
	}

	c.JSON(http.StatusOK, movs)
}