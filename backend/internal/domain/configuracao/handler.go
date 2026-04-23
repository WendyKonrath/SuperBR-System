package configuracao

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

type updateConfigRequest struct {
	EstoqueMinimo int     `json:"alerta_estoque_baixo"`
	PrecoSucata   float64 `json:"preco_sucata_kg"`
}

// ObterConfiguracoes responde com todos os dados vivos na DB ou os falbacks nativos do Service.
func (h *Handler) ObterConfiguracoes(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"alerta_estoque_baixo": h.service.GetEstoqueMinimo(),
		"preco_sucata_kg":      h.service.GetPrecoSucataKg(),
	})
}

// AtualizarConfiguracoes executa a inserção dupla e processa as conversões remotas em tempo real.
func (h *Handler) AtualizarConfiguracoes(c *gin.Context) {
	var req updateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "dados inválidos para configuração"})
		return
	}

	if req.PrecoSucata <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "preço não pode ser nulo"})
		return
	}
	if req.EstoqueMinimo < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "limite de estoque negativo"})
		return
	}

	if err := h.service.UpdateConfigs(req.EstoqueMinimo, req.PrecoSucata); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "falha ao salvar variaveis no sistema"})
		return
	}

	// Fetch formatado para devolução OK
	c.JSON(http.StatusOK, gin.H{
		"message":              "Configurações atualizadas com sucesso",
		"alerta_estoque_baixo": req.EstoqueMinimo,
		"preco_sucata_kg":      req.PrecoSucata,
	})
}
