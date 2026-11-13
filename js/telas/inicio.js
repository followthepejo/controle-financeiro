// Resumo do mês (fatura): quanto gastou, quanto sobra, crédito/débito e categorias.
import { html, montar, brl, dataBR, dataCurta } from '../comum/util.js';
import { resumoMes, diasRestantes, periodoFatura } from '../comum/calculos.js';
import { seletorMes, barra } from '../ui.js';

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
  const todas = est.verTodasCat;
  const cats = todas ? r.categorias : r.categorias.slice(0, 6);
  const maiorCat = r.categorias[0]?.valor || 1;
  const recentes = mes.gastos.filter((g) => !g.oculto).slice().sort((a, b) => (b.data || '').localeCompare(a.data || '')).slice(0, 8);

  montar(raiz, html`
    ${seletorMes(ids, mes.id)}
    <section class="cartao destaque-total">
      <span class="rotulo">Total gasto</span>
      <b class="grande">${brl(r.gasto)}</b>
      <div class="duas">
        <div><span class="rotulo">Saldo</span><b class="${r.saldo < 0 ? 'neg' : 'pos'}">${brl(r.saldo)}</b></div>
        <div><span class="rotulo">Ganho</span><b>${brl(r.ganho)}</b></div>
      </div>
    </section>
    <div class="duas">
      <section class="cartao">
        <span class="rotulo">Crédito</span><b>${brl(r.credito)}</b>
        ${r.tetoCredito ? html`${barra(r.usoCredito, r.usoCredito > 1)}<small class="sutil">teto ${brl(r.tetoCredito)}</small>` : ''}
      </section>
      <section class="cartao">
        <span class="rotulo">Débito</span><b>${brl(r.debito)}</b>
        ${r.tetoDebito ? html`${barra(r.usoDebito, r.usoDebito > 1)}<small class="sutil">teto ${brl(r.tetoDebito)}</small>` : ''}
      </section>
    </div>
    <section class="cartao linha-info">
      <div><span class="rotulo">Fatura</span><b>${dataBR(per.inicio).slice(0, 5)} a ${dataBR(per.ultimoDia).slice(0, 5)}</b></div>
      <div><span class="rotulo">${dias != null && dias < 0 ? 'Fechou' : 'Fecha em'}</span><b>${dias == null ? '—' : dias < 0 ? `há ${-dias} dia(s)` : dias === 0 ? 'hoje' : `${dias} dia(s)`}</b></div>
      <div><span class="rotulo">Próximo mês</span><b>${brl(r.proximoMes)}</b></div>
    </section>
    <section class="cartao">
      <h3>Por categoria</h3>
      ${r.categorias.length ? html`<ul class="lista-cat">${cats.map((c) => html`<li><div class="cat-topo"><span>${c.nome}</span><b>${brl(c.valor)}</b></div>${barra(c.valor / maiorCat, false)}</li>`)}</ul>
        ${r.categorias.length > 6 ? html`<button class="btn link" id="ver-cat">${todas ? 'Ver menos' : `Ver todas (${r.categorias.length})`}</button>` : ''}`
      : html`<p class="sutil">Nenhum gasto neste mês.</p>`}
    </section>
    <section class="cartao">
      <h3>Últimos gastos</h3>
      ${recentes.length ? html`<ul class="lista-gastos">${recentes.map((g) => html`<li><span class="data">${dataCurta(g.data)}</span><span class="desc">${g.descricao}<small>${g.tipo || 'Sem categoria'}${g.parcela && g.parcela !== '1/1' ? ` · ${g.parcela}` : ''}</small></span><b>${brl(g.valor)}</b></li>`)}</ul>`
      : html`<p class="sutil">Nada lançado ainda.</p>`}
    </section>`);

  raiz.querySelectorAll('[data-mes]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.mes) { est.mesId = b.dataset.mes; ctx.redesenhar(); } }));
  raiz.querySelector('#ver-cat')?.addEventListener('click', () => { est.verTodasCat = !est.verTodasCat; ctx.redesenhar(); });
}
