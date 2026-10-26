// Integração do relatório com a API Spring Boot da Lúmen.
// O backend deve estar em execução em http://localhost:8080.
const API_URL = 'http://localhost:8080/api/transacoes';
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
let todasTransacoes = [];
const cores = ['#d4a62a', '#6aa84f', '#3b3b5c', '#c45f5f', '#3876a8', '#9b59b6', '#e67e22'];

function campo(obj, nomes) {
  for (const nome of nomes) if (obj && obj[nome] !== undefined && obj[nome] !== null) return obj[nome];
  return null;
}
function dataTransacao(t) {
  const raw = campo(t, ['dataTransacao','data','DATA_TRANSACAO','DATA']);
  if (!raw) return null;
  if (Array.isArray(raw)) return new Date(raw[0], (raw[1] || 1)-1, raw[2] || 1);
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}
function valorTransacao(t) {
  const v = Number(campo(t, ['valor','VALOR','amount']) ?? 0);
  return Number.isFinite(v) ? Math.abs(v) : 0;
}
function tipoTransacao(t) {
  return String(campo(t, ['tipo','TIPO','type']) ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
}
function descricaoCategoria(t) {
  const cat = campo(t, ['categoria','nomeCategoria','NOME_CATEGORIA']);
  if (typeof cat === 'string' && cat.trim()) return cat;
  const id = campo(t, ['idCategoria','ID_CATEGORIA','categoriaId']);
  return id !== null ? `Categoria ${id}` : 'Sem categoria identificada';
}
function eDespesa(t) {
  const tipo = tipoTransacao(t);
  if (/(RECEITA|ENTRADA|INCOME|CREDITO|CRÉDITO)/.test(tipo)) return false;
  if (/(DESPESA|SAIDA|SAÍDA|EXPENSE|DEBITO|DÉBITO)/.test(tipo)) return true;
  // Se o sistema usa outro padrão de tipo, mantemos o registro como despesa para o relatório.
  return true;
}
function formatarData(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function transacoesFiltradas() {
  const mi = Number(document.getElementById('mesInicial').value);
  const ai = Number(document.getElementById('anoInicial').value);
  const mf = Number(document.getElementById('mesFinal').value);
  const af = Number(document.getElementById('anoFinal').value);
  const inicio = new Date(ai, mi, 1); const fim = new Date(af, mf + 1, 0, 23, 59, 59, 999);
  if (inicio > fim) { mostrarStatus('A data inicial deve ser anterior à data final.', true); return []; }
  return todasTransacoes.filter(t => { const d=dataTransacao(t); return d && d >= inicio && d <= fim && eDespesa(t); });
}
function renderizar() {
  const transacoes = transacoesFiltradas();
  const total = transacoes.reduce((s,t)=>s+valorTransacao(t),0);
  const datas = transacoes.map(dataTransacao).filter(Boolean).sort((a,b)=>a-b);
  const semanas = datas.length ? Math.max(1, Math.ceil((datas[datas.length-1]-datas[0])/(7*86400000))+1) : 1;
  document.getElementById('totalGastos').textContent = moeda.format(total);
  document.getElementById('mediaSemanal').textContent = moeda.format(total/semanas);
  const grupos = new Map();
  transacoes.forEach(t=>{const nome=descricaoCategoria(t); grupos.set(nome,(grupos.get(nome)||0)+valorTransacao(t));});
  const ordenadas = [...grupos.entries()].sort((a,b)=>b[1]-a[1]);
  document.getElementById('gastoEmAlta').textContent = ordenadas.length ? ordenadas[0][0] : 'Sem dados';
  const lista = document.getElementById('listaCategorias');
  const legenda = document.getElementById('legendaCategorias');
  if (!ordenadas.length) {
    lista.innerHTML='<p>Nenhuma despesa encontrada no período.</p>';
    legenda.innerHTML='<p>Nenhuma despesa encontrada no período.</p>';
    document.getElementById('graficoCategorias').style.background='#d8d5ff';
    return;
  }
  lista.innerHTML = ordenadas.map(([nome,v])=>`<p><strong>${escapar(nome)}</strong> — ${moeda.format(v)}</p>`).join('');
  legenda.innerHTML = ordenadas.map(([nome,v],i)=>`<p class="legenda-item"><span class="cor" style="background:${cores[i%cores.length]}"></span>${escapar(nome)} — ${moeda.format(v)}</p>`).join('');
  let graus=0; const partes=ordenadas.map(([nome,v],i)=>{const prox=graus+(v/total*360);const trecho=`${cores[i%cores.length]} ${graus}deg ${prox}deg`;graus=prox;return trecho;});
  document.getElementById('graficoCategorias').style.background=`conic-gradient(${partes.join(',')})`;
}
function escapar(v) { return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function mostrarStatus(msg, erro=false) { const el=document.getElementById('statusApi'); el.textContent=msg; el.classList.toggle('erro',erro); }
async function carregarDados() {
  try {
    mostrarStatus('Carregando transações da API...');
    const resposta=await fetch(API_URL);
    if(!resposta.ok) throw new Error(`API respondeu com status ${resposta.status}`);
    const dados=await resposta.json();
    todasTransacoes=Array.isArray(dados)?dados:(dados.content || dados.data || []);
    renderizar();
    mostrarStatus(`${todasTransacoes.length} transação(ões) carregada(s) da API.`);
  } catch(e) {
    console.error(e);
    mostrarStatus('Não foi possível acessar a API. Confirme se o Spring Boot está rodando e se o CORS permite acesso ao frontend.',true);
    document.getElementById('listaCategorias').innerHTML='<p>API indisponível. Inicie o backend e atualize a página.</p>';
    document.getElementById('legendaCategorias').innerHTML='<p>API indisponível.</p>';
    document.getElementById('totalGastos').textContent='—';
    document.getElementById('mediaSemanal').textContent='—';
    document.getElementById('gastoEmAlta').textContent='—';
  }
}
document.getElementById('btnFiltrar').addEventListener('click',renderizar);
document.getElementById('btnResumoAnual').addEventListener('click',()=>{
  const ano = document.getElementById('anoFinal');
  document.getElementById('mesInicial').value='0'; document.getElementById('mesFinal').value='11';
  document.getElementById('anoInicial').value=ano.value; renderizar();
});
carregarDados();
