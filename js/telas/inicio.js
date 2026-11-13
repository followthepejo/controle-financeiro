// Painel do mês (fatura) — o mesmo do PC: ganho, gasto, saldo, comprometido, gastos no crédito/débito, tetos e maiores gastos.
// Tocar em Crédito ou Débito (ou numa categoria) abre a lista desses gastos.
import { html, montar, brl, pct, dataBR, dataCurta } from '../comum/util.js';
import { resumoMes, diasRestantes, periodoFatura } from '../comum/calculos.js';
import { seletorMes, barra, I } from '../ui.js';

function barras(lista, op) {
  const maior = Math.max(1, ...lista.map((c) => c.valor));
  return html`<ul class="barras">${lista.map((c) => html`<li data-cat="${c.nome}" data-op="${op}">
    <span class="b-nome">${c.nome}</span>
    <span class="b-trilho"><i data-w="${((c.valor / maior) * 100).toFixed(1)}"></i></span>
    <b class="b-valor">${brl(c.valor)}</b></li>`)}</ul>`;
}

export function render(est, raiz, ctx) {
  const d = est.dados;
  const ids = d.meses.map((m) => m.id);
  const mes = d.meses.find((m) => m.id === est.mesId);
  if (!mes) {
    montar(raiz, html`<section class="vazio"><h2>Nenhum mês ainda</h2><p class="sutil">Os meses criados no PC aparecem aqui depois da sincronização.</p></section>`);
    return;
  }
  const r = resumoMes(d, mes);
  const dias = diasRestantes(mes);
  const per = periodoFatura(d, mes);
  const porDia = dias > 0 ? r.saldo / dias : null;
  const credito = r.categorias.filter((c) => c.operacao !== 'Débito' && c.valor > 0);
  const valorDeb = new Map(r.categorias.filter((c) => c.operacao === 'Débito').map((c) => [c.nome, c.valor]));
  const debito = [...new Set([...d.categorias.filter((c) => c.operacao === 'Débito').map((c) => c.nome), ...valorDeb.keys()])]
    .map((nome) => ({ nome, valor: valorDeb.get(nome) || 0 })).sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, 'pt-BR'));
  const maiores = [...mes.gastos].filter((g) => !g.oculto && !/^fixo$/i.test(g.parcela || '')).sort((a, b) => b.valor - a.valor).slice(0, 6);
  const corUso = (u) => (u > 1 ? 'perigo' : u > 0.8 ? 'alerta' : '');

  montar(raiz, html`
    ${seletorMes(ids, mes.id)}
    <p class="sutil pequeno centro">Compras de ${dataBR(per.inicio)} a ${dataBR(per.ultimoDia)} · ${dias == null ? '' : dias > 0 ? `fecha em ${dias} ${dias === 1 ? 'dia' : 'dias'} (${dataCurta(per.fim)})` : `fechou em ${dataCurta(per.fim)}`}</p>
    <div class="duas">
      <section class="cartao kpi"><span class="rotulo">Ganho no mês</span><b>${brl(r.ganho)}</b><small class="sutil">Líquido ${brl(r.liquido)} + benefícios${mes.receitas.extra ? ' + extra' : ''}</small></section>
      <section class="cartao kpi"><span class="rotulo">Saldo</span><b class="${r.saldo < 0 ? 'neg' : 'pos'}">${brl(r.saldo)}</b><small class="sutil">${porDia != null ? `Pode gastar ${brl(Math.max(0, porDia))}/dia` : 'Ganho − gasto'}</small></section>
    </div>
    <section class="cartao kpi destaque-total">
      <span class="rotulo">Gasto no mês</span><b class="grande">${brl(r.gasto)}</b>
      <div class="duas">
        <button class="tile" data-abrir="Crédito"><span class="rotulo">Crédito ${I.dir}</span><b>${brl(r.credito)}</b></button>
        <button class="tile" data-abrir="Débito"><span class="rotulo">Débito ${I.dir}</span><b>${brl(r.debito)}</b></button>
      </div>
    </section>
    <section class="cartao kpi"><span class="rotulo">Já comprometido no próximo mês</span><b>${brl(r.proximoMes)}</b><small class="sutil">Assinaturas ${brl(r.assinaturas)} · Parcelas ${brl(r.parcelados)}</small></section>

    <section class="cartao">
      <button class="cartao-topo link-topo" data-abrir="Crédito"><h3>Gastos no Crédito</h3><b>${brl(r.credito)} ${I.dir}</b></button>
      ${credito.length ? barras(credito, 'Crédito') : html`<p class="sutil">Nenhum gasto no crédito.</p>`}
    </section>
    <section class="cartao">
      <button class="cartao-topo link-topo" data-abrir="Débito"><h3>Gastos no Débito</h3><b>${brl(r.debito)} ${I.dir}</b></button>
      ${debito.length ? barras(debito, 'Débito') : html`<p class="sutil">Nenhuma categoria de débito.</p>`}
    </section>

    <section class="cartao">
      <h3>Tetos de gasto</h3>
      <div class="teto"><span>Crédito</span><div>${barra(r.usoCredito, false)}<small class="sutil">${brl(r.credito)} de ${brl(r.tetoCredito || 0)} · ${pct(r.usoCredito)}</small></div></div>
      <div class="teto"><span>Débito</span><div>${barra(r.usoDebito, false)}<small class="sutil">${brl(r.debito)} de ${brl(r.tetoDebito || 0)} · ${pct(r.usoDebito)}</small></div></div>
      <h3 class="mt">Maiores gastos</h3>
      ${maiores.length ? html`<ul class="lista-gastos">${maiores.map((g) => html`<li><span class="desc">${g.descricao}<small>${g.tipo || 'Sem categoria'}${g.parcela && g.parcela !== '1/1' ? ` · ${g.parcela}` : ''}</small></span><b>${brl(g.valor)}</b></li>`)}</ul>` : html`<p class="sutil">Nada lançado ainda.</p>`}
    </section>`);

  // cor das barras dos tetos (verde → amarelo → vermelho, como no PC)
  const tetos = raiz.querySelectorAll('.teto .barra i');
  [r.usoCredito, r.usoDebito].forEach((u, k) => { const c = corUso(u); if (c && tetos[k]) tetos[k].classList.add(c); });

  raiz.querySelectorAll('[data-mes]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.mes) { est.mesId = b.dataset.mes; ctx.redesenhar(); } }));
  raiz.onclick = (e) => {
    const cat = e.target.closest('[data-cat]');
    const ab = e.target.closest('[data-abrir]');
    if (cat) { est.gastosOp = cat.dataset.op; est.gastosCat = cat.dataset.cat; ctx.irPara('gastos'); }
    else if (ab) { est.gastosOp = ab.dataset.abrir; est.gastosCat = ''; ctx.irPara('gastos'); }
  };
}
