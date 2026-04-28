package sucata

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// Handler agrupa os endpoints HTTP do domínio de sucata.
type Handler struct {
	service *Service
}

// NewHandler cria o handler com o service injetado.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

type entradaSucataInput struct {
	ProdutoID *uint   `json:"produto_id"`
	Descricao string  `json:"descricao"`
	Peso      float64 `json:"peso" binding:"gt=0"`
	VendaID   *uint   `json:"venda_id"`
}

type editarLoteInput struct {
	ProdutoID *uint   `json:"produto_id"`
	Descricao string  `json:"descricao"`
	Peso      float64 `json:"peso" binding:"min=0"`
	VendaID   *uint   `json:"venda_id"`
	Estado    string  `json:"estado" binding:"required"`
}

// EntradaSucata registra a chegada de unidades de sucata para um produto específico.
// POST /api/sucata/entrada
func (h *Handler) EntradaSucata(c *gin.Context) {
	var input entradaSucataInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": "informe produto_id e peso (mínimo > 0)"})
		return
	}

	usuarioID, _ := c.Get("usuario_id")
	sucata, err := h.service.EntradaSucata(nil, input.ProdutoID, input.Descricao, input.Peso, input.VendaID, usuarioID.(uint), "")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": err.Error()})
		return
	}

	c.JSON(http.StatusOK, sucata)
}

// EditarLote reajusta os dados do lote de sucata.
// PUT /api/sucata/lotes/:id
func (h *Handler) EditarLote(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": "id inválido"})
		return
	}

	var input editarLoteInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": "informe produto_id, peso e estado"})
		return
	}

	usuarioID, _ := c.Get("usuario_id")

	sucata, err := h.service.EditarLote(uint(id), input.Peso, input.ProdutoID, input.Descricao, input.VendaID, input.Estado, usuarioID.(uint))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": err.Error()})
		return
	}

	c.JSON(http.StatusOK, sucata)
}

// Listar retorna todos os lotes de sucata com seus produtos.
// GET /api/sucata
func (h *Handler) Listar(c *gin.Context) {
	sucatas, err := h.service.Listar()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"erro": "erro ao listar sucata"})
		return
	}

	c.JSON(http.StatusOK, sucatas)
}

// BuscarPorID retorna um lote específico.
// GET /api/sucata/:id
func (h *Handler) BuscarPorID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": "id inválido"})
		return
	}

	sucata, err := h.service.BuscarPorID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"erro": err.Error()})
		return
	}

	c.JSON(http.StatusOK, sucata)
}

// DeletarLote remove um lote de sucata do sistema.
// DELETE /api/sucata/lotes/:id
func (h *Handler) DeletarLote(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": "id inválido"})
		return
	}

	if err := h.service.DeletarLote(uint(id)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"mensagem": "lote excluído com sucesso"})
}