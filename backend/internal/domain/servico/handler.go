package servico

import (
	"net/http"
	"strconv"
	"super-br/internal/auth"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

type servicoInput struct {
	Nome  string  `json:"nome" binding:"required"`
	Valor float64 `json:"valor" binding:"required,min=0"`
}

// Criar lida com POST /api/servicos
func (h *Handler) Criar(c *gin.Context) {
	var input servicoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": "dados inválidos — verifique nome e valor"})
		return
	}

	s, err := h.service.Criar(input.Nome, input.Valor)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, s)
}

// Listar lida com GET /api/servicos
func (h *Handler) Listar(c *gin.Context) {
	servicos, err := h.service.Listar()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"erro": "erro ao listar serviços"})
		return
	}

	c.JSON(http.StatusOK, servicos)
}

// BuscarPorID lida com GET /api/servicos/:id
func (h *Handler) BuscarPorID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": "id inválido"})
		return
	}

	s, err := h.service.BuscarPorID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"erro": err.Error()})
		return
	}

	c.JSON(http.StatusOK, s)
}

// Atualizar lida com PUT /api/servicos/:id
func (h *Handler) Atualizar(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": "id inválido"})
		return
	}

	var input servicoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": "dados inválidos"})
		return
	}

	// Pega o nome do usuário logado para colocar na notificação
	claims, exists := c.Get("usuario")
	usuarioNome := "Usuário Desconhecido"
	if exists {
		if c, ok := claims.(*auth.Claims); ok {
			usuarioNome = c.Login
		}
	}

	s, err := h.service.Atualizar(uint(id), input.Nome, input.Valor, usuarioNome)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": err.Error()})
		return
	}

	c.JSON(http.StatusOK, s)
}

// Deletar lida com DELETE /api/servicos/:id
func (h *Handler) Deletar(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": "id inválido"})
		return
	}

	if err := h.service.Deletar(uint(id)); err != nil {
		c.JSON(http.StatusConflict, gin.H{"erro": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"mensagem": "serviço removido com sucesso"})
}
