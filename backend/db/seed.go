package db

import (
	"fmt"
	"super-br/config"
	"super-br/internal/domain/usuario"
	"super-br/internal/domain/configuracao"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func Seed(db *gorm.DB, cfg *config.Config) {
	senhaHash, err := bcrypt.GenerateFromPassword([]byte(cfg.SuperAdminPassword), 12)
	if err != nil {
		fmt.Println("Erro ao gerar hash da senha do superadmin:", err)
		return
	}

	var existente usuario.Usuario
	result := db.Where("login = ?", cfg.SuperAdminLogin).First(&existente)

	if result.Error != nil {
		superAdmin := usuario.Usuario{
			Nome:           "Super Admin",
			Login:          cfg.SuperAdminLogin,
			Senha:          string(senhaHash),
			Perfil:         "superadmin",
			PrimeiroAcesso: false,
			Ativo:          true,
		}
		db.Create(&superAdmin)
		fmt.Println("Superadmin criado.")
	} else {
		updates := map[string]interface{}{
			"senha":           string(senhaHash),
			"perfil":          "superadmin",
			"ativo":           true,
			"primeiro_acesso": false,
		}
		db.Model(&existente).Updates(updates)
		fmt.Println("Superadmin verificado.")
	}

	// Seed de Configurações
	var count int64
	db.Model(&configuracao.Configuracao{}).Count(&count)
	if count == 0 {
		novaConfig := configuracao.Configuracao{
			ValorSucata:   3.00,
			EstoqueMinimo: 5,
		}
		db.Create(&novaConfig)
		fmt.Println("Configuração inicial criada.")
	}
}