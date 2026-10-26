```javascript
const API_URL = "http://localhost:8080/api/transacoes";
const cores = ["#7c3aed", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"];
let transacoes = [];

const elemento = (id) => document.getElementById(id);

function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function obterCampo(objeto, nomes) {
    for (const nome of nomes) {
        if (objeto[nome] !== undefined && objeto[nome] !== null) {
            return objeto[nome];
        }
    }
    return null;
}

function obterData(transacao) {
    const valor = obterCampo(transacao, [
        "dataTransacao", "DATA_TRANSACAO", "data", "DATA"
    ]);
    if (!valor) return null;

    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? null : data;
}

function obterValor(transacao) {
    const valor = Number(obterCampo(transacao, ["valor", "VALOR"]) || 0);
    return Number.isFinite(valor) ? valor : 0;
}

function obterTipo(transacao) {
    return String(obterCampo(transacao, ["tipo", "TIPO"]) || "")
        .trim()
        .toUpperCase();
}

function ehDespesa(transacao) {
    return ["DESPESA", "SAIDA", "SAÍDA", "D", "EXPENSE"]
        .includes(obterTipo(transacao));
}

function obterCategoria(transacao) {
    const nome = obterCampo(transacao, [
        "nomeCategoria", "NOME_CATEGORIA",
        "categoriaNome", "CATEGORIA_NOME"
    ]);
    if (nome) return String(nome);

    const id = obterCampo(transacao, [
        "idCategoria", "ID_CATEGORIA", "categoriaId"
    ]);
    return id !== null ? `Categoria ${id}` : "Sem categoria";
}

function obterTransacoesFiltradas() {
    const mesInicial = Number(elemento("mesInicial").value);
    const anoInicial = Number(elemento("anoInicial").value);
    const mesFinal = Number(elemento("mesFinal").value);
    const anoFinal = Number(elemento("anoFinal").value);

    const inicio = new Date(anoInicial, mesInicial, 1);
    const fim = new Date(anoFinal, mesFinal + 1, 0, 23, 59, 59, 999);

    return transacoes.filter((transacao) => {
        const data = obterData(transacao);
        return data && data >= inicio && data <= fim && ehDespesa(transacao);
    });
}

function escaparHtml(valor) {
    return String(valor).replace(/[&<>"']/g, caractere => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caractere]);
}

function renderizarRelatorio() {
    const filtradas = obterTransacoesFiltradas();
    const totais = {};

    filtradas.forEach(transacao => {
        const categoria = obterCategoria(transacao);
        totais[categoria] = (totais[categoria] || 0) + Math.abs(obterValor(transacao));
    });

    const categorias = Object.entries(totais).sort((a, b) => b[1] - a[1]);
    const total = categorias.reduce((soma, item) => soma + item[1], 0);

    elemento("totalGastos").textContent = formatarMoeda(total);

    const datas = filtradas.map(obterData).filter(Boolean);
    let mediaSemanal = 0;

    if (datas.length > 0) {
        const menorData = new Date(Math.min(...datas.map(data => data.getTime())));
        const maiorData = new Date(Math.max(...datas.map(data => data.getTime())));
        const dias = Math.max(1, Math.ceil((maiorData - menorData) / 86400000) + 1);
        mediaSemanal = total / (dias / 7);
    }

    elemento("mediaSemanal").textContent = formatarMoeda(mediaSemanal);
    elemento("gastoEmAlta").textContent = categorias.length ? categorias[0][0] : "Sem dados";

    elemento("listaCategorias").innerHTML = categorias.length
        ? categorias.map(([nome, valor]) =>
            `<p><strong>${escaparHtml(nome)}</strong> — ${formatarMoeda(valor)}</p>`
          ).join("")
        : "<p>Nenhuma despesa encontrada no período.</p>";

    elemento("legendaCategorias").innerHTML = categorias.length
        ? categorias.map(([nome, valor], indice) => `
            <p class="legenda-item">
                <span class="cor" style="background:${cores[indice % cores.length]}"></span>
                ${escaparHtml(nome)} — ${formatarMoeda(valor)}
            </p>
          `).join("")
        : "<p>Sem dados para exibir.</p>";

    let acumulado = 0;
    const gradientes = categorias.map(([, valor], indice) => {
        const percentual = total ? (valor / total) * 100 : 0;
        const inicio = acumulado;
        acumulado += percentual;
        return `${cores[indice % cores.length]} ${inicio}% ${acumulado}%`;
    });

    elemento("graficoCategorias").style.background = total
        ? `conic-gradient(${gradientes.join(", ")})`
        : "#e5e7eb";

    elemento("statusApi").textContent =
        `${filtradas.length} despesa(s) encontrada(s) no período selecionado.`;
}

async function carregarTransacoes() {
    elemento("statusApi").textContent = "Carregando transações da API...";

    try {
        const resposta = await fetch(API_URL);
        if (!resposta.ok) throw new Error(`A API respondeu com status ${resposta.status}.`);

        const dados = await resposta.json();
        transacoes = Array.isArray(dados) ? dados : (dados.content || dados.data || []);
        renderizarRelatorio();
    } catch (erro) {
        console.error("Erro ao carregar transações:", erro);
        elemento("statusApi").textContent =
            "Não foi possível carregar os dados. Verifique o backend e o acesso à API.";
        elemento("listaCategorias").innerHTML = "<p>Erro ao carregar os dados da API.</p>";
        elemento("legendaCategorias").innerHTML = "<p>Não foi possível carregar os dados.</p>";
    }
}

elemento("btnFiltrar").addEventListener("click", renderizarRelatorio);

elemento("btnResumoAnual").addEventListener("click", () => {
    const ano = elemento("anoFinal").value;
    elemento("mesInicial").value = "0";
    elemento("anoInicial").value = ano;
    elemento("mesFinal").value = "11";
    elemento("anoFinal").value = ano;
    renderizarRelatorio();
});

carregarTransacoes();
```
