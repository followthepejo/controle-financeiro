// Ler prints da fatura NO CELULAR: escolhe as imagens, o celular lê o texto (sem mandar a imagem para ninguém),
// você confere dono e categoria de cada gasto e confirma. Mesmas regras do PC (não duplica, completa o que faltava).
import { html, montar, $, brl, nomeMes, dataBR, lerValor, avisar, alertar, confirmar, hojeISO, somarMes } from '../comum/util.js';
import { juntarPrints } from '../comum/conciliar.js';
import { mapaAprendido, faturaDaCompra } from '../comum/calculos.js';
import { prepararLidos, classificar, aplicar, aprenderApelidos } from '../comum/lancamentos.js';
import { lerPrintCelular } from '../ocr-celular.js';
import { I } from '../ui.js';

function rascunho(est) {
  if (!est.print) est.print = { imagens: [], itens: null, destino: faturaDaCompra(est.dados, hojeISO()), quem: est.dados.config.pessoaPadrao, lendo: false, progresso: 0, faltas: [], pagamentos: 0 };
  return est.print;
}

function situacao(x) {
  if (x.acao === 'existe') return html`<span class="etiqueta">Já lançado</span>`;
  if (x.acao === 'completar') return html`<span class="etiqueta completar">Completa ${x.completa.join(' e ')}</span>`;
  if (x.soCartao) return html`<span class="etiqueta novo">Novo · só cartão</span>`;
  if (x.outraFatura) return html`<span class="etiqueta aviso">Novo · data de ${nomeMes(x.outraFatura)}</span>`;
  return html`<span class="etiqueta novo">${x.estorno ? 'Estorno' : 'Novo'}</span>`;
}

export function render(est, raiz, ctx) {
  const d = est.dados;
  const r = rascunho(est);
  const cats = [...d.categorias].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const ids = d.meses.map((m) => m.id);
  const destinos = [...new Set([...ids.slice(-6), ids.length ? somarMes(ids.at(-1), 1) : r.destino, r.destino])].sort().reverse();
  const sel = () => (r.itens || []).filter((x) => x.marcado);

  montar(raiz, html`
    <h2 class="titulo-tela">Ler print da fatura</h2>
    ${!r.itens ? html`
      <section class="cartao">
        <label class="escolher">${I.foto}<b>Escolher prints</b><span class="sutil">da galeria (pode escolher vários)</span>
          <input type="file" id="arquivos" accept="image/*" multiple hidden></label>
        ${r.imagens.length ? html`<div class="miniaturas">${r.imagens.map((im, i) => html`<figure><img src="${im.url}" alt=""><button class="icone-btn pequeno" data-tirar="${i}" aria-label="Tirar">${I.lixo}</button></figure>`)}</div>` : ''}
        <label>Lançar na fatura de<select id="destino">${destinos.map((id) => html`<option value="${id}" ${id === r.destino ? 'selected' : ''}>${nomeMes(id)}${ids.includes(id) ? '' : ' (novo)'}</option>`)}</select></label>
        <label>Dono padrão<select id="quem">${d.config.pessoas.map((p) => html`<option ${p === r.quem ? 'selected' : ''}>${p}</option>`)}</select></label>
        <button class="btn primario grande" id="ler" ${!r.imagens.length || r.lendo ? 'disabled' : ''}>${r.lendo ? `Lendo… ${Math.round(r.progresso * 100)}%` : `Ler ${r.imagens.length || ''} ${r.imagens.length === 1 ? 'imagem' : 'imagens'}`}</button>
        ${r.lendo ? html`<div class="barra"><i data-w="${(r.progresso * 100).toFixed(0)}"></i></div>` : ''}
        <p class="sutil pequeno">A leitura acontece aqui no celular; a imagem não vai para lugar nenhum. Na primeira vez ele baixa o leitor (uns 6 MB).</p>
      </section>`
    : html`
      <section class="cartao">
        <div class="cartao-topo"><h3>Confira</h3><span class="sutil">${sel().length} · ${brl(sel().reduce((s, x) => s + x.valor, 0))}</span></div>
        <p class="sutil pequeno">Fatura de <b>${nomeMes(r.destino)}</b>. Os gastos de ${d.config.pessoaPadrao} vão para o mês e o cartão; os das outras pessoas, só para o cartão.</p>
        ${r.pagamentos ? html`<p class="sutil pequeno">${r.pagamentos} pagamento(s) de fatura ignorado(s).</p>` : ''}
        ${r.faltas.length ? html`<div class="faixa-aviso">${I.alerta} <b>Compras cortadas (não serão lançadas):</b><ul>${r.faltas.map((f) => html`<li>${f.texto}</li>`)}</ul></div>` : ''}
      </section>
      ${r.itens.map((x, i) => html`<section class="cartao item-print ${x.marcado ? '' : 'desmarcado'}" data-i="${i}">
        <div class="item-topo"><label class="check"><input type="checkbox" data-c="marcado" ${x.marcado ? 'checked' : ''}><span></span></label>${situacao(x)}<b class="item-valor">${brl(x.valor)}</b></div>
        <input data-c="descricao" value="${x.descricao}" maxlength="120" aria-label="Descrição">
        ${x.nomeSalvo ? html`<small class="sutil">nome salvo · lido: ${x.lido}</small>` : ''}
        <div class="tres">
          <input type="date" data-c="data" value="${x.data}" aria-label="Data">
          <input data-c="valor" value="${x.valor.toFixed(2).replace('.', ',')}" inputmode="decimal" aria-label="Valor">
          <input data-c="parcela" value="${x.parcela}" maxlength="10" aria-label="Parcela">
        </div>
        <div class="duas">
          <select data-c="quem" aria-label="Dono">${d.config.pessoas.map((p) => html`<option ${p === x.quem ? 'selected' : ''}>${p}</option>`)}</select>
          <select data-c="tipo" aria-label="Categoria"><option value="">— categoria —</option>${cats.map((c) => html`<option value="${c.nome}" ${c.nome === x.tipo ? 'selected' : ''}>${c.nome}</option>`)}</select>
        </div>
        ${x.acao === 'existe' || x.acao === 'completar' ? html`<small class="sutil">${x.alvoDescricao}</small>` : ''}
      </section>`)}
      <div class="barra-acoes"><button class="btn" id="descartar">Descartar</button><button class="btn primario" id="lancar">${I.check} Lançar ${sel().length}</button></div>`}`);

  if (!r.itens) {
    $('#arquivos').addEventListener('change', (e) => {
      for (const f of e.target.files) r.imagens.push({ arquivo: f, url: URL.createObjectURL(f) });
      ctx.redesenhar();
    });
    raiz.querySelectorAll('[data-tirar]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); const [im] = r.imagens.splice(Number(b.dataset.tirar), 1); URL.revokeObjectURL(im.url); ctx.redesenhar(); }));
    $('#destino').onchange = (e) => { r.destino = e.target.value; };
    $('#quem').onchange = (e) => { r.quem = e.target.value; };
    $('#ler').onclick = async () => {
      r.lendo = true; r.progresso = 0; ctx.redesenhar();
      try {
        const resultados = [];
        let fatura = null;
        for (let k = 0; k < r.imagens.length; k++) {
          const res = await lerPrintCelular(r.imagens[k].arquivo, Number(r.destino.slice(0, 4)), (p) => {
            r.progresso = (k + p) / r.imagens.length;
            const b = $('#ler'); if (b) b.textContent = `Lendo… ${Math.round(r.progresso * 100)}%`;
            const i = raiz.querySelector('.barra i'); if (i) i.style.width = `${r.progresso * 100}%`;
          });
          if (res.fatura_mes && /^\d{4}-\d{2}$/.test(res.fatura_mes)) fatura = res.fatura_mes;
          resultados.push(res);
        }
        const { itens, faltas } = juntarPrints(resultados);
        let lidos = prepararLidos(d, itens, r.quem, mapaAprendido(d));
        r.pagamentos = lidos.filter((x) => x.pagamento).length;
        lidos = lidos.filter((x) => !x.pagamento);
        if (fatura) r.destino = fatura;
        classificar(d, r.destino, lidos);
        r.itens = lidos; r.faltas = faltas; r.lendo = false;
        const n = (a) => lidos.filter((x) => x.acao === a).length;
        avisar(lidos.length ? `${lidos.length} lidos: ${n('novo')} novos, ${n('completar')} para completar, ${n('existe')} já lançados.` : 'Não achei lançamentos nas imagens.', lidos.length ? 'info' : 'erro');
        if (!lidos.length) r.itens = null;
        ctx.redesenhar();
        if (faltas.length) await alertar('Faltou parte de algum print', 'Algumas compras apareceram cortadas e não estão inteiras em nenhum print. Elas não serão lançadas:', faltas.map((f) => f.texto));
      } catch (e) { r.lendo = false; avisar(e.message, 'erro'); ctx.redesenhar(); }
    };
    return;
  }

  raiz.onchange = (e) => {
    const card = e.target.closest('[data-i]'); const c = e.target.dataset.c;
    if (!card || !c) return;
    const x = r.itens[Number(card.dataset.i)];
    if (c === 'marcado') x.marcado = e.target.checked;
    else if (c === 'valor') { const v = lerValor(e.target.value); if (Number.isFinite(v)) x.valor = v; else return avisar('Valor inválido.', 'erro'); }
    else x[c] = e.target.value.trim();
    if (c === 'quem' || c === 'data' || c === 'valor') classificar(d, r.destino, r.itens);
    ctx.redesenhar();
  };
  $('#descartar').onclick = async () => {
    if (!(await confirmar('Descartar a leitura?', 'Os itens lidos somem e nada é lançado.', 'Descartar', true))) return;
    for (const im of r.imagens) URL.revokeObjectURL(im.url);
    est.print = null; ctx.redesenhar();
  };
  $('#lancar').onclick = async () => {
    const marcados = sel();
    if (!marcados.length) return avisar('Nenhum gasto marcado.', 'erro');
    const semData = marcados.filter((x) => !x.data).length;
    if (semData) return avisar(`${semData} gasto(s) sem data. Preencha antes.`, 'erro');
    classificar(d, r.destino, r.itens);
    const ativos = marcados.filter((x) => x.acao !== 'existe');
    const eu = d.config.pessoaPadrao;
    const porPessoa = new Map();
    for (const x of ativos) { const t = porPessoa.get(x.quem) || { n: 0, v: 0 }; t.n++; t.v += x.valor; porPessoa.set(x.quem, t); }
    const semCat = ativos.filter((x) => x.quem === eu && !x.tipo).length;
    const texto = [...porPessoa].map(([p, t]) => `${p}: ${t.n} · ${brl(t.v)}${p === eu ? ' (mês + cartão)' : ' (só cartão)'}`).join(' | ') || 'Nada novo (tudo já estava lançado).';
    if (!(await confirmar(`Lançar na fatura de ${nomeMes(r.destino)}?`, texto + (semCat ? ` · ${semCat} sem categoria` : ''), 'Confirmar e lançar'))) return;
    const res = aplicar(d, r.destino, ativos);
    aprenderApelidos(d, marcados);
    for (const im of r.imagens) URL.revokeObjectURL(im.url);
    est.print = null; est.mesId = res.mes.id;
    await ctx.salvar();
    avisar(`${nomeMes(res.mes.id)}: ${res.novos} no seu mês, ${res.completados} completados, ${res.noCartao} no cartão.`);
    ctx.irPara('inicio');
  };
}

export { dataBR };
