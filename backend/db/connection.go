// Package db gerencia a conexão com o banco de dados e a migração automática de tabelas.
package db

import (
	"fmt"
	"log"

	"super-br/config"
	"super-br/internal/domain/configuracao"
	"super-br/internal/domain/estoque"
	movimentacao_sucata "super-br/internal/domain/movimentacao_sucata"
	"super-br/internal/domain/movimentacao"
	"super-br/internal/domain/notificacao"
	"super-br/internal/domain/produto"
	"super-br/internal/domain/relatorio"
	"super-br/internal/domain/sucata"
	"super-br/internal/domain/servico"
	"super-br/internal/domain/usuario"
	"super-br/internal/domain/venda"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Connect abre a conexão com o PostgreSQL usando as configurações fornecidas
// e executa AutoMigrate para criar ou atualizar todas as tabelas do sistema.
// A aplicação encerra imediatamente se a conexão falhar.
func Connect(cfg *config.Config) *gorm.DB {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable TimeZone=America/Sao_Paulo",
		cfg.DBHost,
		cfg.DBPort,
		cfg.DBUser,
		cfg.DBPassword,
		cfg.DBName,
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatal("Erro ao conectar no banco de dados: ", err)
	}

	// Ordem importa: tabelas sem FK devem vir antes das que dependem delas.
	err = db.AutoMigrate(
		&configuracao.Configuracao{},
		&usuario.Usuario{},
		&produto.Produto{},
		&estoque.ItemEstoque{},
		&estoque.Estoque{},
		&sucata.EstoqueSucata{},
		&movimentacao.Movimentacao{},
		&movimentacao_sucata.MovimentacaoSucata{},
		&servico.Servico{},
		&venda.Venda{},
		&venda.ItemVenda{},
		&venda.ItemServicoVenda{},
		&venda.Pagamento{},
		&notificacao.Notificacao{},
		&relatorio.Relatorio{},
	)
	if err != nil {
		log.Fatal("Erro ao executar AutoMigrate: ", err)
	}

	// Garante que produto_id aceite NULL (AutoMigrate às vezes não remove a constraint NOT NULL)
	db.Exec("ALTER TABLE estoque_sucatas ALTER COLUMN produto_id DROP NOT NULL")
	// Garante que a coluna descricao exista (AutoMigrate às vezes falha em adicionar colunas em tabelas existentes)
	db.Exec("ALTER TABLE estoque_sucatas ADD COLUMN IF NOT EXISTS descricao VARCHAR(200)")

	fmt.Println("Banco de dados conectado e tabelas sincronizadas.")
	return db
}