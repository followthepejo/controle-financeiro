// Gastos do mês no Crédito ou no Débito (aberto pelo Painel), com filtro por categoria.
import { html, montar, brl, nomeMes, dataCurta } from '../comum/util.js';
import { operacaoDe } from '../comum/calculos.js';
import { I } from '../ui.js';

export function render(est, raiz, ctx) {
  const d = est.dados;
  const op = est.gastosOp === 'Débito' ? 'Débito' : 'Crédito';
  const mes = d.meses.find((m) => m.id === est.mesId);
  if (!mes) { ctx.irPara('inicio'); return; }
  const daOp = mes.gastos.filter((g) => (operacaoDe(d, g.tipo) === 'Débito' ? 'Débito' : 'Crédito') === op);
  const cats = [...new Set(daOp.map((g) => g.tipo || 'Sem categoria'))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const filtro = cats.includes(est.gastosCat) ? est.gastosCat : '';
  const lista = daOp.filter((g) => !filtro || (g.tipo || 'Sem categoria') === filtro)
    .sort((a, b) => Number(!!a.oculto) - Number(!!b.oculto) || (b.data || '').localeCompare(a.data || '') || b.valor - a.valor);
  const total = lista.filter((g) => !g.oculto).reduce((s, g) => s + g.valor, 0);

  montar(raiz, html`
    <div class="voltar-topo"><button class="icone-btn" id="voltar" aria-label="Voltar">${I.esq}</button><h2>${op === 'Crédito' ? 'Cartão de crédito' : 'Débito'}</h2></div>
    <section class="cartao destaque-total">
      <span class="rotulo">${filtro || `Gastos no ${op}`} · ${nomeMes(mes.id)}</span>
      <b class="grande">${brl(total)}</b>
      <small class="sutil">${lista.length} ${lista.length === 1 ? 'gasto' : 'gastos'}${lista.some((g) => g.oculto) ? ' · ocultos não somam' : ''}</small>
    </section>
    ${cats.length > 1 ? html`<div class="chips rolar"><button class="chip ${!filtro ? 'ativo' : ''}" data-f="">Todas</button>${cats.map((c) => html`<button class="chip ${c === filtro ? 'ativo' : ''}" data-f="${c}">${c}</button>`)}</div>` : ''}
    <section class="cartao">
      ${lista.length ? html`<ul class="lista-gastos">${lista.map((g) => html`<li class="${g.oculto ? 'oculto' : ''} ${/^fixo$/i.test(g.parcela || '') ? 'assinatura' : ''}">
        <span class="data">${g.data ? dataCurta(g.data) : '—'}</span>
        <span class="desc">${g.descricao}<small>${g.tipo || 'Sem categoria'}${g.parcela && g.parcela !== '1/1' && !(/^fixo$/i.test(g.parcela) && /^assinatura$/i.test(g.tipo || '')) ? ` · ${/^fixo$/i.test(g.parcela) ? 'Assinatura' : g.parcela}` : ''}${g.oculto ? ' · oculto' : ''}</small></span>
        <b>${brl(g.valor)}</b></li>`)}</ul>`
      : html`<p class="sutil">Nenhum gasto no ${op.toLowerCase()} neste mês.</p>`}
    </section>
    <p class="sutil pequeno centro">Para editar ou apagar um gasto, use a aba Mês no PC.</p>`);

  raiz.querySelector('#voltar').onclick = () => ctx.irPara('inicio');
  raiz.onclick = (e) => { const c = e.target.closest('[data-f]'); if (c) { est.gastosCat = c.dataset.f; ctx.redesenhar(); } };
}
