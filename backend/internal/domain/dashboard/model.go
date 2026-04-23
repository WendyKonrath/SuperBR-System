package dashboard

type Estatisticas struct {
	MetricasCards       MetricasCards       `json:"metricas_cards"`
	FluxoFinanceiro     []FluxoMensal       `json:"fluxo_financeiro"`
	DistribuicaoEstoque []ProdutoEstoque    `json:"distribuicao_estoque"`
	Alertas             []Alerta            `json:"alertas"`
}

type MetricasCards struct {
	TotalEstoque int     `json:"total_estoque"`
	ValorTotal   float64 `json:"valor_total"`
	EstoqueBaixo int     `json:"estoque_baixo"`
	VendasDia    int     `json:"vendas_dia"`
}

type FluxoMensal struct {
	Mes            string  `json:"mes"`
	ReceitaVendas  float64 `json:"receita_vendas"`
	CustoReposicao float64 `json:"custo_reposicao"`
}

type ProdutoEstoque struct {
	Label      string `json:"label"` // Agora carregará "Produto [Categoria]"
	Quantidade int    `json:"quantidade"`
}

type Alerta struct {
	Nivel    string `json:"nivel"`    // "critico", "aviso", "info"
	Mensagem string `json:"mensagem"`
}
