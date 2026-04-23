# 🔋 SuperBR - Sistema de Gestão de Estoque e Sucatas

O **SuperBR** é uma solução robusta e moderna desenvolvida para o gerenciamento de estoques de baterias e controle de sucatas por peso (KG). Projetado para alta performance e facilidade de uso, o sistema utiliza uma arquitetura baseada em micro-serviços via Docker para garantir estabilidade e escalabilidade.

---

## 🚀 Principais Funcionalidades

- **📦 Gestão de Estoque de Precisão**: Cadastro e rastreio de itens individuais com IDs únicos.
- **⚖️ Controle de Sucatas por KG**: Registro de entrada e saída de sucatas baseado em peso decimal (Balança).
- **⚡ Entrada em Massa**: Registro otimizado de múltiplos itens do mesmo lote de uma única vez.
- **📊 Dashboards Dinâmicos**: Visualização em tempo real de estoque, valores investidos e movimentações financeiras.
- **📄 Relatórios PDF**: Geração de comprovantes de vendas e relatórios analíticos de estoque.
- **🔐 Segurança SSL Automática**: Gateway Caddy integrado para HTTPS automático em produção.

---

## 🛠️ Stack Tecnológica

- **Backend**: Go 1.23 (Gin Framework, GORM)
- **Frontend**: React (Vite, Tailwind-ready CSS)
- **Banco de Dados**: PostgreSQL 15
- **Infraestrutura**: Docker & Docker Compose
- **Proxy/SSL**: Caddy Server

---

## ⚙️ Como Rodar o Projeto

### Pré-requisitos
- [Docker](https://www.docker.com/) instalado.

### 1. Configuração de Ambiente
Crie um arquivo `.env` na raiz do projeto baseado no `.env.example`:
```bash
cp .env.example .env
```
Preencha as variáveis como `DB_PASSWORD`, `JWT_SECRET` e `SUPERADMIN_LOGIN`.

### 2. Execução (Desenvolvimento/Teste)
Para rodar o sistema completo localmente:
```bash
docker compose -f docker-compose.prod.yml up --build
```
O sistema estará acessível em: `http://localhost`.

---

## 📡 API Endpoints (Principais)

### Autenticação
- `POST /api/auth/login`: Realiza login e retorna JWT.

### Estoque
- `GET /api/estoque`: Lista resumo de estoque.
- `POST /api/estoque/entrada`: Registro de entrada (aceita `quantidade` para registros em massa).
- `PUT /api/estoque/itens/:id`: Edição completa de item e estado.

### Sucatas
- `GET /api/sucata`: Lista lotes de sucata disponíveis.
- `POST /api/sucata/entrada`: Registro de entrada de sucata (baseado em `peso`).
- `PUT /api/sucata/editar/:id`: Edição de peso e estado do lote.

### Relatórios
- `GET /api/relatorio/geral`: Gera relatório consolidado em PDF.

---

## 🌐 Deploy em Produção

Este projeto já inclui um `Dockerfile.caddy` preparado para produção. Ao realizar o deploy:
1. Aponte seu domínio (DNS) para o IP da VPS.
2. Configure o `Caddyfile` com seu domínio real.
3. O Caddy emitirá os certificados SSL automaticamente.

---

## 📄 Licença
Este projeto é distribuído para fins de gestão interna e demonstração técnica.

---
*Desenvolvido com foco em eficiência e rastreabilidade para o setor de baterias.*
