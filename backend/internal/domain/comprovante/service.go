// Package comprovante gera o PDF de comprovante de venda para assinatura do cliente.
// Layout baseado no modelo oficial "Comprovante de Pedidos" da Baterias Super BR LTDA.
// Biblioteca: github.com/jung-kurt/gofpdf
// O PDF é gerado em memória e transmitido diretamente — nenhum arquivo é salvo em disco.
package comprovante

import (
	"bytes"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/jung-kurt/gofpdf"
	"super-br/internal/domain/venda"
)

const (
	empresaNome     = "Baterias Super BR LTDA."
	empresaEndereco = "R. Cel Matos Dourado 388"
	empresaCNPJ     = "CNPJ: 07.093.375/0001-92"
	empresaTelefone = "(85) 32356040"
)

// Service encapsula a lógica de geração do comprovante em PDF.
type Service struct{}

// NewService cria o service. Não requer diretório nem configuração de disco.
func NewService() *Service {
	return &Service{}
}

// formatarMoedaBRL formata um float64 para o padrão brasileiro: R$ 1.234,56
func formatarMoedaBRL(valor float64) string {
	s := fmt.Sprintf("%.2f", valor)
	partes := strings.Split(s, ".")
	inteiro := partes[0]
	decimal := partes[1]

	var resultado []byte
	n := len(inteiro)
	for i := 0; i < n; i++ {
		if i > 0 && (n-i)%3 == 0 {
			resultado = append(resultado, '.')
		}
		resultado = append(resultado, inteiro[i])
	}

	return "R$ " + string(resultado) + "," + decimal
}

// GerarComprovante gera o PDF do comprovante de uma venda e retorna os bytes do PDF.
// Nenhum arquivo é salvo em disco.
func (s *Service) GerarComprovante(v *venda.Venda) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(12, 10, 12)

	// tr converte UTF-8 para cp1252 (Latin-1 estendido) — resolve ã, ç, é, etc.
	tr := pdf.UnicodeTranslatorFromDescriptor("cp1252")

	pdf.AddPage()
	const larg = 186.0

	// =========================================================
	// CABEÇALHO E INFORMAÇÕES DO PEDIDO (LADO A LADO)
	// =========================================================
	pdf.SetFont("Arial", "B", 16)
	pdf.CellFormat(larg, 8, tr("Comprovante de Pedidos"), "", 1, "C", false, 0, "")

	pdf.SetFont("Arial", "", 10)
	pdf.CellFormat(larg, 5, tr(empresaNome), "", 1, "C", false, 0, "")

	pdf.Ln(6)

	yInfo := pdf.GetY()

	// Esquerda: INFORMAÇÕES DO CLIENTE E PEDIDO
	linhaInfo := func(y float64, label, valor string) {
		pdf.SetXY(12, y)
		pdf.SetFont("Arial", "B", 10)
		w := pdf.GetStringWidth(tr(label)) + 1.5
		pdf.CellFormat(w, 5, tr(label), "", 0, "L", false, 0, "")
		pdf.SetFont("Arial", "", 10)
		pdf.CellFormat(100, 5, tr(valor), "", 0, "L", false, 0, "")
	}

	// Formatador de telefone (XX) XXXXX-XXXX
	re := regexp.MustCompile(`\D`)
	tNums := re.ReplaceAllString(v.TelefoneCliente, "")
	telefoneFormatado := v.TelefoneCliente
	if len(tNums) == 11 {
		telefoneFormatado = fmt.Sprintf("(%s) %s-%s", tNums[0:2], tNums[2:7], tNums[7:])
	} else if len(tNums) == 10 {
		telefoneFormatado = fmt.Sprintf("(%s) %s-%s", tNums[0:2], tNums[2:6], tNums[6:])
	}

	yC := yInfo
	linhaInfo(yC, "Cliente:", v.NomeCliente)
	yC += 5

	if v.Empresa != "" {
		linhaInfo(yC, "Empresa:", v.Empresa)
		yC += 5
	}

	linhaInfo(yC, "Pedido:", fmt.Sprintf("#%d", v.ID))
	yC += 5

	// Formata e adiciona Documento (CPF/CNPJ) se existir
	docStr := v.DocumentoCliente
	reDoc := regexp.MustCompile(`\D`)
	dNums := reDoc.ReplaceAllString(docStr, "")
	if len(dNums) == 11 {
		docStr = fmt.Sprintf("%s.%s.%s-%s", dNums[0:3], dNums[3:6], dNums[6:9], dNums[9:])
	} else if len(dNums) == 14 {
		docStr = fmt.Sprintf("%s.%s.%s/%s-%s", dNums[0:2], dNums[2:5], dNums[5:8], dNums[8:12], dNums[12:])
	}
	if docStr != "" {
		labelDoc := "CPF:"
		if len(dNums) == 14 {
			labelDoc = "CNPJ:"
		} else if docStr != "" && len(dNums) != 11 {
			labelDoc = "Doc.:"
		}
		linhaInfo(yC, labelDoc, docStr)
		yC += 5
	}

	if telefoneFormatado != "" {
		linhaInfo(yC, "Contato:", telefoneFormatado)
		yC += 5
	}
	linhaInfo(yC, "Data:", v.Data.Format("02/01/2006"))

	// Direita: ENDEREÇO FIXO DA EMPRESA
	pdf.SetFont("Arial", "", 9)
	pdf.SetXY(12, yInfo)
	pdf.CellFormat(larg, 5, tr(empresaEndereco), "", 1, "R", false, 0, "")

	pdf.SetFont("Arial", "B", 9)
	pdf.SetXY(12, yInfo+5)
	pdf.CellFormat(larg, 5, tr(empresaCNPJ), "", 1, "R", false, 0, "")

	pdf.SetFont("Arial", "", 9)
	pdf.SetXY(12, yInfo+10)
	pdf.CellFormat(larg, 5, tr(empresaTelefone), "", 1, "R", false, 0, "")

	pdf.SetY(yInfo + 30)

	// =========================================================
	// TABELA DE ITENS
	// =========================================================
	const (
		colQtd    = 25.0
		colDesc   = 65.0
		colSucata = 28.0
		colVUnit  = 34.0
		colTotal  = 34.0
		altLinha  = 7.0
		minLinhas = 5
	)

	pdf.SetFillColor(0, 0, 0)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetFont("Arial", "B", 9)

	pdf.CellFormat(colQtd, altLinha, tr("Quantidade"), "1", 0, "C", true, 0, "")
	pdf.CellFormat(colDesc, altLinha, tr("Discriminação"), "1", 0, "C", true, 0, "")
	pdf.CellFormat(colSucata, altLinha, tr("Sucata"), "1", 0, "C", true, 0, "")
	pdf.CellFormat(colVUnit, altLinha, tr("Valor Unitário"), "1", 0, "C", true, 0, "")
	pdf.CellFormat(colTotal, altLinha, tr("Total"), "1", 1, "C", true, 0, "")

	pdf.SetFillColor(255, 255, 255)
	pdf.SetTextColor(0, 0, 0)
	pdf.SetFont("Arial", "", 9)

	type grupo struct {
		Quantidade    int
		Discriminacao string
		ValorUnitario float64
	}
	agrupados := make(map[string]*grupo)
	var ordem []string

	var itensReembolsados []string
	for _, item := range v.Itens {
		if item.Status == "reembolsado" {
			itensReembolsados = append(itensReembolsados, fmt.Sprintf("#%d", item.ItemEstoque.ID))
			continue
		}

		disc := fmt.Sprintf("[%s] %s (Lote: %s)",
			item.ItemEstoque.Produto.Categoria,
			item.ItemEstoque.Produto.Nome,
			item.ItemEstoque.CodLote,
		)
		chave := fmt.Sprintf("%d_%s_%.2f", item.ItemEstoque.ProdutoID, item.ItemEstoque.CodLote, item.ValorUnitario)

		if g, ok := agrupados[chave]; ok {
			g.Quantidade += item.Quantidade
		} else {
			agrupados[chave] = &grupo{
				Quantidade:    item.Quantidade,
				Discriminacao: disc,
				ValorUnitario: item.ValorUnitario,
			}
			ordem = append(ordem, chave)
		}
	}

	for _, serv := range v.Servicos {
		disc := fmt.Sprintf("[Serviço] %s", serv.Servico.Nome)
		chave := fmt.Sprintf("serv_%d_%.2f", serv.ServicoID, serv.ValorCobrado)

		if g, ok := agrupados[chave]; ok {
			g.Quantidade += serv.Quantidade
		} else {
			agrupados[chave] = &grupo{
				Quantidade:    serv.Quantidade,
				Discriminacao: disc,
				ValorUnitario: serv.ValorCobrado,
			}
			ordem = append(ordem, chave)
		}
	}

	linhasUsadas := 0
	for _, chave := range ordem {
		g := agrupados[chave]
		total := g.ValorUnitario * float64(g.Quantidade)

		pdf.CellFormat(colQtd, altLinha, fmt.Sprintf("%d", g.Quantidade), "1", 0, "C", false, 0, "")
		pdf.CellFormat(colDesc, altLinha, tr(g.Discriminacao), "1", 0, "L", false, 0, "")
		pdf.CellFormat(colSucata, altLinha, "", "1", 0, "C", false, 0, "")
		pdf.CellFormat(colVUnit, altLinha, formatarMoedaBRL(g.ValorUnitario), "1", 0, "R", false, 0, "")
		pdf.CellFormat(colTotal, altLinha, formatarMoedaBRL(total), "1", 1, "R", false, 0, "")
		linhasUsadas++
	}

	for linhasUsadas < minLinhas {
		pdf.CellFormat(colQtd, altLinha, "", "1", 0, "C", false, 0, "")
		pdf.CellFormat(colDesc, altLinha, "", "1", 0, "L", false, 0, "")
		pdf.CellFormat(colSucata, altLinha, "", "1", 0, "C", false, 0, "")
		pdf.CellFormat(colVUnit, altLinha, "R$ ---", "1", 0, "R", false, 0, "")
		pdf.CellFormat(colTotal, altLinha, "R$ ---", "1", 1, "R", false, 0, "")
		linhasUsadas++
	}

	// =========================================================
	// ASSINATURA + PAGAMENTOS
	// =========================================================
	const (
		colAssVend  = 60.0
		colAssCli   = 58.0
		colPagLabel = 34.0
		colPagValor = 34.0
		altHeader   = 7.0
		altAss      = 18.0
	)

	pdf.SetFillColor(0, 0, 0)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetFont("Arial", "B", 9)

	pdf.CellFormat(colAssVend, altHeader, tr("Ass. Vendedor"), "1", 0, "C", true, 0, "")
	pdf.CellFormat(colAssCli, altHeader, tr("Ass. Cliente"), "1", 0, "C", true, 0, "")
	pdf.CellFormat(colPagLabel+colPagValor, altHeader, tr("Valor Total"), "1", 1, "C", true, 0, "")

	xBase := pdf.GetX()
	yBase := pdf.GetY()

	pdf.SetTextColor(0, 0, 0)
	pdf.SetFont("Arial", "", 9)

	pdf.SetXY(xBase, yBase)
	pdf.CellFormat(colAssVend, altAss, "", "1", 0, "C", false, 0, "")
	pdf.SetXY(xBase+colAssVend, yBase)
	pdf.CellFormat(colAssCli, altAss, "", "1", 0, "C", false, 0, "")

	valores := map[string]float64{"dinheiro": 0, "pix": 0, "credito": 0, "debito": 0, "sucata": 0}
	for _, pg := range v.Pagamentos {
		if _, ok := valores[pg.Tipo]; ok {
			valores[pg.Tipo] += pg.Valor
		}
	}

	xPag := xBase + colAssVend + colAssCli
	yPag := yBase
	altPagLinha := altAss / 5.0

	linhasPag := []struct{ label, chave string }{
		{"Dinheiro", "dinheiro"},
		{"Pix", "pix"},
		{"Crédito", "credito"},
		{"Débito", "debito"},
		{"Sucata", "sucata"},
	}

	for _, lp := range linhasPag {
		pdf.SetXY(xPag, yPag)
		pdf.CellFormat(colPagLabel, altPagLinha, tr(lp.label), "1", 0, "C", false, 0, "")
		valStr := "R$ ---"
		if valores[lp.chave] > 0 {
			valStr = formatarMoedaBRL(valores[lp.chave])
		}
		pdf.CellFormat(colPagValor, altPagLinha, valStr, "1", 0, "R", false, 0, "")
		yPag += altPagLinha
	}

	pdf.SetXY(xBase, yBase+altAss)

	// =========================================================
	// OBSERVAÇÕES + RESUMO FINANCEIRO
	// =========================================================
	const altObs = 24.0

	pdf.SetFillColor(0, 0, 0)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetFont("Arial", "B", 9)

	pdf.CellFormat(colAssVend+colAssCli, altHeader, tr("Observações"), "1", 0, "C", true, 0, "")
	pdf.CellFormat(colPagLabel+colPagValor, altHeader, tr("RESUMO FINANCEIRO"), "1", 1, "C", true, 0, "")

	xObs := pdf.GetX()
	yObs := pdf.GetY()

	largObs := colAssVend + colAssCli

	pdf.SetDrawColor(0, 0, 0)
	pdf.SetTextColor(0, 0, 0)
	pdf.Rect(xObs, yObs, largObs, altObs, "D")

	obsFinal := v.Observacoes
	if len(itensReembolsados) > 0 {
		prefix := ""
		if obsFinal != "" {
			prefix = "\n\n"
		}
		obsFinal += prefix + "Itens Reembolsados: " + strings.Join(itensReembolsados, ", ")
	}

	if obsFinal != "" {
		pdf.SetFont("Arial", "", 8)
		pdf.SetXY(xObs+2, yObs+2)
		pdf.MultiCell(largObs-4, 4, tr(obsFinal), "", "L", false)
	}

	pdf.SetTextColor(0, 0, 0)
	pdf.SetXY(xObs+largObs, yObs)
	pdf.SetFont("Arial", "B", 8)
	pdf.CellFormat(colPagLabel, altObs/4.0, tr("VALOR DA VENDA:"), "1", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "", 8)
	pdf.CellFormat(colPagValor, altObs/4.0, formatarMoedaBRL(v.ValorTotal), "1", 1, "R", false, 0, "")

	pdf.SetXY(xObs+largObs, yObs+(altObs/4.0))
	pdf.SetFont("Arial", "B", 8)
	pdf.CellFormat(colPagLabel, altObs/4.0, tr("TOTAL RECEBIDO:"), "1", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "", 8)
	pdf.CellFormat(colPagValor, altObs/4.0, formatarMoedaBRL(v.ValorPago), "1", 1, "R", false, 0, "")

	pdf.SetXY(xObs+largObs, yObs+(2*altObs/4.0))
	pdf.SetFont("Arial", "B", 8)
	pdf.CellFormat(colPagLabel, altObs/4.0, tr("TROCO A DEVOLVER:"), "1", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "B", 8)
	pdf.SetTextColor(0, 0, 0)
	if v.Troco > 0 {
		pdf.SetTextColor(0, 100, 0)
	}
	pdf.CellFormat(colPagValor, altObs/4.0, formatarMoedaBRL(v.Troco), "1", 1, "R", false, 0, "")

	pdf.SetXY(xObs+largObs, yObs+(3*altObs/4.0))
	pdf.SetFont("Arial", "B", 8)
	pdf.SetTextColor(0, 0, 0)
	pdf.CellFormat(colPagLabel, altObs/4.0, tr("TROCO DEVOLVIDO:"), "1", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "B", 8)
	if v.TrocoDevolvido > 0 {
		pdf.SetTextColor(0, 100, 150)
	}
	pdf.CellFormat(colPagValor, altObs/4.0, formatarMoedaBRL(v.TrocoDevolvido), "1", 1, "R", false, 0, "")
	pdf.SetTextColor(0, 0, 0)

	pdf.SetXY(xObs, yObs+altObs)

	// =========================================================
	// RODAPÉ
	// =========================================================
	pdf.Ln(4)
	pdf.SetFont("Arial", "", 7)
	pdf.SetTextColor(150, 150, 150)
	pdf.CellFormat(larg, 5,
		tr(fmt.Sprintf("Documento gerado em %s", time.Now().Format("02/01/2006 às 15:04:05"))),
		"", 1, "C", false, 0, "")

	// Gerar PDF em memória (sem salvar em disco)
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("erro ao gerar PDF em memória: %w", err)
	}

	return buf.Bytes(), nil
}
