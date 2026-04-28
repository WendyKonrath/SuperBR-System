// Package main é o ponto de entrada da API do sistema Super BR Estoque.
package main

import (
	"log"

	"super-br/config"
	"super-br/db"
	"super-br/internal/domain/comprovante"
	"super-br/internal/domain/configuracao"
	"super-br/internal/domain/estoque"
	"super-br/internal/domain/movimentacao"
	movs "super-br/internal/domain/movimentacao_sucata"
	"super-br/internal/domain/notificacao"
	"super-br/internal/domain/produto"
	"super-br/internal/domain/relatorio"
	"super-br/internal/domain/sucata"
	"super-br/internal/domain/servico"
	"super-br/internal/domain/usuario"
	"super-br/internal/domain/venda"
	"super-br/internal/domain/dashboard"
	"super-br/internal/middleware"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()
	database := db.Connect(cfg)
	db.Seed(database, cfg)

	// Repositórios
	usuarioRepo := usuario.NewRepository(database)
	produtoRepo := produto.NewRepository(database)
	estoqueRepo := estoque.NewRepository(database)
	movRepo := movimentacao.NewRepository(database)
	movSucataRepo := movs.NewRepository(database)
	sucataRepo := sucata.NewRepository(database)
	servicoRepo := servico.NewRepository(database)
	vendaRepo := venda.NewRepository(database)
	notifRepo := notificacao.NewRepository(database)
	configRepo := configuracao.NewRepository(database)

	// Services
	// notifService é criado primeiro pois é injetado nos outros services.
	notifService := notificacao.NewService(notifRepo)
	configService := configuracao.NewService(configRepo, database)

	usuarioService := usuario.NewService(usuarioRepo, cfg.JWTSecret, cfg.JWTExpirationHours)
	produtoService := produto.NewService(produtoRepo)
	servicoService := servico.NewService(servicoRepo, notifService)
	estoqueService := estoque.NewService(estoqueRepo, produtoRepo, movRepo, notifService, configService)
	sucataService := sucata.NewService(sucataRepo, movSucataRepo, configService)
	vendaService := venda.NewService(vendaRepo, estoqueRepo, produtoRepo, movRepo, notifService, estoqueService, sucataService)
	movimentacaoService := movimentacao.NewService(movRepo)
	movSucataService := movs.NewService(movSucataRepo)
	dashboardService := dashboard.NewService(estoqueRepo, vendaRepo, movRepo)
	relatorioService := relatorio.NewService(database, vendaService, estoqueService, movimentacaoService, sucataService)

	// comprovanteService gera PDFs em memória — sem salvar em disco.
	comprovanteService := comprovante.NewService()

	// Handlers
	usuarioHandler := usuario.NewHandler(usuarioService)
	produtoHandler := produto.NewHandler(produtoService)
	servicoHandler := servico.NewHandler(servicoService)
	estoqueHandler := estoque.NewHandler(estoqueService)
	sucataHandler := sucata.NewHandler(sucataService)
	vendaHandler := venda.NewHandler(vendaService)
	movimentacaoHandler := movimentacao.NewHandler(movimentacaoService)
	movSucataHandler := movs.NewHandler(movSucataService)
	notifHandler := notificacao.NewHandler(notifService)
	configHandler := configuracao.NewHandler(configService)
	comprovanteHandler := comprovante.NewHandler(comprovanteService, vendaService)
	dashboardHandler := dashboard.NewHandler(dashboardService)
	relatorioHandler := relatorio.NewHandler(relatorioService)

	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", cfg.AllowedOrigin)
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204) // Responde imediatamente ao pre-flight
			return
		}

		c.Next()
	})

	// Rotas publicas
	public := r.Group("/api")
	{
		public.POST("/auth/login", middleware.RateLimitLogin(), usuarioHandler.Login)
		public.POST("/auth/primeiro-acesso", usuarioHandler.PrimeiroAcesso)
	}

	// Rotas protegidas
	protected := r.Group("/api")
	protected.Use(middleware.Autenticar(cfg.JWTSecret))
	{
		protected.GET("/auth/me", usuarioHandler.Me)

		// Usuarios
		protected.GET("/usuarios", middleware.ExigirPerfil("admin"), usuarioHandler.Listar)
		protected.POST("/usuarios", middleware.ExigirPerfil("admin"), usuarioHandler.Criar)
		protected.PUT("/usuarios/:id", middleware.ExigirPerfil("admin"), usuarioHandler.Atualizar)
		protected.PATCH("/usuarios/:id/desativar", middleware.ExigirPerfil("admin"), usuarioHandler.Desativar)
		protected.PATCH("/usuarios/:id/ativar", middleware.ExigirPerfil("admin"), usuarioHandler.Ativar)
		protected.PATCH("/usuarios/:id/resetar-senha", middleware.ExigirPerfil("admin"), usuarioHandler.ResetarSenha)

		// Produtos
		protected.GET("/produtos", produtoHandler.Listar)
		protected.GET("/produtos/:id", produtoHandler.BuscarPorID)
		protected.POST("/produtos", middleware.ExigirPerfil("admin", "gerente"), produtoHandler.Criar)
		protected.PUT("/produtos/:id", middleware.ExigirPerfil("admin", "gerente"), produtoHandler.Atualizar)
		protected.DELETE("/produtos/:id", middleware.ExigirPerfil("admin", "gerente"), produtoHandler.Deletar)

		// Serviços
		protected.GET("/servicos", servicoHandler.Listar)
		protected.GET("/servicos/:id", servicoHandler.BuscarPorID)
		protected.POST("/servicos", middleware.ExigirPerfil("admin", "gerente"), servicoHandler.Criar)
		protected.PUT("/servicos/:id", middleware.ExigirPerfil("admin", "gerente"), servicoHandler.Atualizar)
		protected.DELETE("/servicos/:id", middleware.ExigirPerfil("admin", "gerente"), servicoHandler.Deletar)

		// Estoque - itens individuais
		protected.GET("/estoque/itens", estoqueHandler.ListarItens)
		protected.GET("/estoque/itens/:id", estoqueHandler.BuscarItemPorID)
		protected.PUT("/estoque/itens/:id", middleware.ExigirPerfil("admin", "gerente"), estoqueHandler.EditarItem)
		protected.POST("/estoque/entrada", middleware.ExigirPerfil("admin", "gerente"), estoqueHandler.EntradaEstoque)
		protected.POST("/estoque/saida", middleware.ExigirPerfil("admin", "gerente"), estoqueHandler.SaidaEstoque)
		protected.PATCH("/estoque/itens/:id/devolver", middleware.ExigirPerfil("admin", "gerente"), estoqueHandler.DevolverItem)
		protected.PATCH("/estoque/itens/:id/emprestar", middleware.ExigirPerfil("admin", "gerente"), estoqueHandler.EmprestarItem)
		protected.PATCH("/estoque/itens/:id/devolver-emprestimo", middleware.ExigirPerfil("admin", "gerente"), estoqueHandler.DevolverEmprestimo)
		protected.POST("/estoque/sincronizar", middleware.ExigirPerfil("admin", "gerente"), estoqueHandler.SincronizarEstoque)

		// Estoque - resumo por produto
		protected.GET("/estoque", estoqueHandler.ListarEstoque)
		protected.GET("/estoque/produto/:produto_id", estoqueHandler.BuscarEstoquePorProduto)

		// Sucata
		protected.GET("/sucata", sucataHandler.Listar)
		protected.GET("/sucata/:id", sucataHandler.BuscarPorID)
		protected.POST("/sucata/entrada", middleware.ExigirPerfil("admin", "gerente"), sucataHandler.EntradaSucata)
		protected.PUT("/sucata/lotes/:id", middleware.ExigirPerfil("admin", "gerente"), sucataHandler.EditarLote)
		protected.DELETE("/sucata/lotes/:id", middleware.ExigirPerfil("admin", "gerente"), sucataHandler.DeletarLote)

		// Vendas
		protected.POST("/vendas", middleware.ExigirPerfil("admin", "gerente", "vendas"), vendaHandler.CriarVenda)
		protected.PUT("/vendas/:id", middleware.ExigirPerfil("admin", "gerente", "vendas"), vendaHandler.AtualizarVenda)
		protected.GET("/vendas", middleware.ExigirPerfil("admin", "gerente", "financeiro", "vendas"), vendaHandler.Listar)
		protected.GET("/vendas/:id", middleware.ExigirPerfil("admin", "gerente", "financeiro", "vendas"), vendaHandler.BuscarPorID)
		protected.PATCH("/vendas/:id/confirmar", middleware.ExigirPerfil("admin", "gerente", "vendas"), vendaHandler.ConfirmarVenda)
		protected.PATCH("/vendas/:id/cancelar", middleware.ExigirPerfil("admin", "gerente", "vendas"), vendaHandler.CancelarVenda)
		protected.PATCH("/vendas/:id/devolver", middleware.ExigirPerfil("admin", "gerente", "vendas"), vendaHandler.DevolverVenda)
		protected.PATCH("/vendas/:id/observacoes", middleware.ExigirPerfil("admin", "gerente", "financeiro", "vendas"), vendaHandler.AtualizarObservacoes)

		// Comprovante de venda em PDF — acessível para admin, gerente, financeiro e vendas
		protected.GET("/vendas/:id/comprovante", middleware.ExigirPerfil("admin", "gerente", "financeiro", "vendas"), comprovanteHandler.Gerar)

		// Movimentacoes de baterias
		protected.GET("/movimentacoes", middleware.ExigirPerfil("admin", "gerente", "financeiro"), movimentacaoHandler.Listar)

		// Movimentacoes de sucata
		protected.GET("/movimentacoes/sucata", middleware.ExigirPerfil("admin", "gerente", "financeiro"), movSucataHandler.Listar)

		// Notificacoes
		protected.GET("/notificacoes", middleware.ExigirPerfil("admin", "gerente"), notifHandler.Listar)
		protected.PATCH("/notificacoes/:id/ler", middleware.ExigirPerfil("admin", "gerente"), notifHandler.MarcarComoLida)
		protected.PATCH("/notificacoes/ler-todas", middleware.ExigirPerfil("admin", "gerente"), notifHandler.MarcarTodasComoLidas)

		// Configuracoes Locais/Globais do Sistema
		protected.GET("/configuracoes", configHandler.ObterConfiguracoes)
		protected.PUT("/configuracoes", middleware.ExigirPerfil("admin"), configHandler.AtualizarConfiguracoes)

		// Dashboard Estatísticas
		protected.GET("/dashboard/stats", middleware.ExigirPerfil("admin", "gerente", "financeiro"), dashboardHandler.ObterEstatisticas)

		// Relatórios Avançados (PDF e Agregados)
		protected.GET("/relatorios/vendas/dados", middleware.ExigirPerfil("admin", "gerente", "financeiro"), relatorioHandler.ObterDadosVendas)
		protected.GET("/relatorios/vendas/pdf", middleware.ExigirPerfil("admin", "gerente", "financeiro"), relatorioHandler.GerarPDFVendas)
		protected.GET("/relatorios/estoque/pdf", middleware.ExigirPerfil("admin", "gerente", "financeiro"), relatorioHandler.GerarPDFEstoque)
	}

	if err := r.Run(":" + cfg.ServerPort); err != nil {
		log.Fatal("Erro ao iniciar servidor: ", err)
	}
}