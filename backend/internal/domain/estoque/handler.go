package estoque

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// Handler agrupa os endpoints HTTP do domínio de estoque.
type Handler struct {
	service *Service
}

// NewHandler cria o handler com o service injetado.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// entradaEstoqueInput representa o corpo da requisição de entrada de item.
type entradaEstoqueInput struct {
	ProdutoID  uint   `json:"produto_id" binding:"required"`
	CodLote    string `json:"cod_lote" binding:"required"`
	Quantidade int    `json:"quantidade"`
}

type editarItemInput struct {
	ProdutoID  uint   `json:"produto_id" binding:"required"`
	CodLote    string `json:"cod_lote" binding:"required"`
	Estado     string `json:"estado" binding:"required"`
	Observacao string `json:"observacao"`
	VendaID    uint   `json:"venda_id"`
}

// saidaEstoqueInput representa o corpo da requisição de saída de item.
type saidaEstoqueInput struct {
	ItemID uint `json:"item_id" binding:"required"`
}

// EntradaEstoque registra a chegada de uma nova bateria no estoque.
// POST /api/estoque/entrada
func (h *Handler) EntradaEstoque(c *gin.Context) {
	var input entradaEstoqueInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": "informe produto_id e cod_lote"})
		return
	}

	usuarioID, _ := c.Get("usuario_id")
	qtd := input.Quantidade
	if qtd <= 0 {
		qtd = 1
	}

	err := h.service.EntradaEstoque(input.ProdutoID, input.CodLote, qtd, usuarioID.(uint))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"mensagem": "entrada(s) registrada(s) com sucesso"})
}

// SaidaEstoque registra a saída manual de um item do estoque pelo seu ID.
// POST /api/estoque/saida
func (h *Handler) SaidaEstoque(c *gin.Context) {
	var input saidaEstoqueInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": "informe item_id"})
		return
	}

	usuarioID, _ := c.Get("usuario_id")

	item, err := h.service.SaidaEstoque(input.ItemID, usuarioID.(uint))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": err.Error()})
		return
	}

	c.JSON(http.StatusOK, item)
}

// EditarItem modifica livremente atributos e estado do lote de forma transacional.
// PUT /api/estoque/itens/:id
func (h *Handler) EditarItem(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": "id inválido"})
		return
	}

	var input editarItemInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": "informe produto_id, cod_lote e estado"})
		return
	}

	usuarioID, _ := c.Get("usuario_id")
	item, err := h.service.EditarItem(uint(id), input.ProdutoID, input.CodLote, input.Estado, input.Observacao, input.VendaID, usuarioID.(uint))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

// ListarItens handle o endpoint para listar itens de estoque com filtros (produto, estado, período).
func (h *Handler) ListarItens(c *gin.Context) {
	produtoIDStr := c.Query("produto_id")
	estado := c.Query("estado")
	inicio := c.Query("inicio")
	fim := c.Query("fim")

	var produtoID uint
	if produtoIDStr != "" {
		id, err := strconv.ParseUint(produtoIDStr, 10, 32)
		if err == nil {
			produtoID = uint(id)
		}
	}

	itens, err := h.service.ListarItensFiltrados(produtoID, estado, inicio, fim)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"erro": "erro ao listar itens"})
		return
	}

	c.JSON(http.StatusOK, itens)
}

// BuscarItemPorID retorna um item de estoque pelo seu ID único.
// GET /api/estoque/itens/:id
func (h *Handler) BuscarItemPorID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": "id inválido"})
		return
	}

	item, err := h.service.BuscarItemPorID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"erro": err.Error()})
		return
	}

	c.JSON(http.StatusOK, item)
}

// ListarEstoque retorna o resumo consolidado de estoque por produto.
// GET /api/estoque
func (h *Handler) ListarEstoque(c *gin.Context) {
	estoques, err := h.service.ListarEstoque()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"erro": "erro ao listar estoque"})
		return
	}

	c.JSON(http.StatusOK, estoques)
}

// BuscarEstoquePorProduto retorna o resumo de estoque de um produto específico.
// GET /api/estoque/produto/:produto_id
func (h *Handler) BuscarEstoquePorProduto(c *gin.Context) {
	produtoID, err := strconv.ParseUint(c.Param("produto_id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": "produto_id inválido"})
		return
	}

	e, err := h.service.BuscarEstoquePorProduto(uint(produtoID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"erro": err.Error()})
		return
	}

	c.JSON(http.StatusOK, e)
}

// DevolverItem retorna ao estoque um item que havia saído manualmente.
// PATCH /api/estoque/itens/:id/devolver
func (h *Handler) DevolverItem(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": "id inválido"})
		return
	}

	usuarioID, _ := c.Get("usuario_id")

	item, err := h.service.DevolverItem(uint(id), usuarioID.(uint))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": err.Error()})
		return
	}

	c.JSON(http.StatusOK, item)
}

// EmprestarItem marca uma bateria como emprestada, removendo-a do estoque disponível.
// PATCH /api/estoque/itens/:id/emprestar
func (h *Handler) EmprestarItem(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": "id inválido"})
		return
	}

	usuarioID, _ := c.Get("usuario_id")

	item, err := h.service.EmprestarItem(uint(id), usuarioID.(uint))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": err.Error()})
		return
	}

	c.JSON(http.StatusOK, item)
}

// DevolverEmprestimo retorna ao estoque disponível um item que estava emprestado.
// PATCH /api/estoque/itens/:id/devolver-emprestimo
func (h *Handler) DevolverEmprestimo(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": "id inválido"})
		return
	}

	usuarioID, _ := c.Get("usuario_id")

	item, err := h.service.DevolverEmprestimo(uint(id), usuarioID.(uint))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"erro": err.Error()})
		return
	}

	c.JSON(http.StatusOK, item)
}

// SincronizarEstoque força o recalculo de todos os saldos agregados.
// POST /api/estoque/sincronizar
func (h *Handler) SincronizarEstoque(c *gin.Context) {
	if err := h.service.SincronizarTodoEstoque(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"erro": "erro ao sincronizar estoque: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"mensagem": "estoque sincronizado com sucesso"})
}