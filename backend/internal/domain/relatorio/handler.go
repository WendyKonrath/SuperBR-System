package relatorio

import (
	"bytes"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func NewHandler(s *Service) *Handler {
	return &Handler{service: s}
}

// ObterDadosVendas retorna as estatísticas agregadas para o dashboard
func (h *Handler) ObterDadosVendas(c *gin.Context) {
	inicioStr := c.Query("inicio")
	fimStr := c.Query("fim")

	inicio, err := time.Parse("2006-01-02", inicioStr)
	if err != nil {
		inicio = time.Now().AddDate(0, 0, -30) // Default 30 dias
	}

	fim, err := time.Parse("2006-01-02", fimStr)
	if err != nil {
		fim = time.Now()
	}

	resumo, err := h.service.ObterDadosVendas(inicio, fim)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao buscar dados: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, resumo)
}

// GerarPDFVendas gera e retorna o PDF de vendas
func (h *Handler) GerarPDFVendas(c *gin.Context) {
	inicioStr := c.Query("inicio")
	fimStr := c.Query("fim")

	inicio, _ := time.Parse("2006-01-02", inicioStr)
	fim, _ := time.Parse("2006-01-02", fimStr)

	resumo, err := h.service.ObterDadosVendas(inicio, fim)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	pdf, err := h.service.GerarPDFVendas(resumo)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", "attachment; filename=relatorio_vendas.pdf")
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// GerarPDFEstoque gera e retorna o PDF de estoque atual e histórico
func (h *Handler) GerarPDFEstoque(c *gin.Context) {
	inicioStr := c.Query("inicio")
	fimStr := c.Query("fim")

	inicio, _ := time.Parse("2006-01-02", inicioStr)
	fim, _ := time.Parse("2006-01-02", fimStr)

	// Se não houver datas, ObterDadosEstoque usará o mês atual por padrão
	resumo, err := h.service.ObterDadosEstoque(inicio, fim)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	pdf, err := h.service.GerarPDFEstoque(resumo)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", "attachment; filename=relatorio_estoque.pdf")
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}
