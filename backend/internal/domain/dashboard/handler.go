package dashboard

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func NewHandler(s *Service) *Handler {
	return &Handler{service: s}
}

func (h *Handler) ObterEstatisticas(c *gin.Context) {
	stats, err := h.service.ObterEstatisticas()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"erro": "Erro ao calcular estatísticas"})
		return
	}
	c.JSON(http.StatusOK, stats)
}
