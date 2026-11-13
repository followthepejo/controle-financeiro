// Cartão compartilhado, por pessoa, na fatura escolhida (igual à tabela dinâmica da planilha).
import { html, montar, brl, dataCurta, somarMes, hojeISO, nomeMes } from '../comum/util.js';
import { faturaDaCompra } from '../comum/calculos.js';
import { assinaturaConhecida } from '../comum/assinaturas.js';
import { seletorMes, barra } from '../ui.js';

export function render(est, raiz, ctx) {
  const d = est.dados;
  const fatDe = (dt) => faturaDaCompra(d, dt);
  const ids = [...new Set([...d.cartao.map((c) => fatDe(c.data)).filter(Boolean), ...d.meses.map((m) => m.id)])].sort();
  if (!est.fatCartao || !ids.includes(est.fatCartao)) est.fatCartao = ids.includes(est.mesId) ? est.mesId : ids.at(-1) || fatDe(hojeISO());
  const fat = est.fatCartao;
  const itens = d.cartao.filter((c) => fatDe(c.data) === fat);
  const ehAssin = (c) => c.assinatura === true || (c.assinatura !== false && /^fixo$/i.test(c.parcelas || '')) || (c.assinatura == null && !!assinaturaConhecida(d, c.descricao, c.valor));
  const pessoas = [...new Set([...d.config.pessoas, ...itens.map((c) => c.quem)])];
  const grupos = pessoas.map((p) => {
    const lista = itens.filter((c) => c.quem === p).sort((a, b) => Number(ehAssin(b)) - Number(ehAssin(a)) || (b.data || '').localeCompare(a.data || ''));
    const total = lista.filter((c) => !c.oculto).reduce((s, c) => s + c.valor, 0);
    return { p, lista, total };
  }).filter((g) => g.lista.length);
  const totalGeral = grupos.reduce((s, g) => s + g.total, 0);
  est.abertos = est.abertos || new Set([d.config.pessoaPadrao]);
  // próxima fatura: parcelas que continuam
  const proxima = itens.filter((c) => !c.oculto && (/^fixo$/i.test(c.parcelas || '') || (() => { const m = String(c.parcelas || '').match(/^(\d+)\/(\d+)$/); return m && Number(m[1]) < Number(m[2]); })())).reduce((s, c) => s + c.valor, 0);

  montar(raiz, html`
    ${seletorMes(ids, fat)}
    <section class="cartao destaque-total">
      <span class="rotulo">Fatura de ${fat ? nomeMes(fat) : '—'}</span>
      <b class="grande">${brl(totalGeral)}</b>
      <small class="sutil">${itens.length} lançamentos · continua em ${nomeMes(somarMes(fat, 1))}: ${brl(proxima)}</small>
    </section>
    ${grupos.length ? grupos.map((g) => html`
      <section class="cartao pessoa ${est.abertos.has(g.p) ? 'aberto' : ''}">
        <button class="pessoa-topo" data-pessoa="${g.p}">
          <span>${g.p}<small>${g.lista.length} ${g.lista.length === 1 ? 'compra' : 'compras'}</small></span>
          <b>${brl(g.total)}</b>
        </button>
        ${barra(totalGeral ? g.total / totalGeral : 0, false)}
        ${est.abertos.has(g.p) ? html`<ul class="lista-gastos">${g.lista.map((c) => html`<li class="${c.oculto ? 'oculto' : ''} ${ehAssin(c) ? 'assinatura' : ''}">
          <span class="data">${dataCurta(c.data)}</span>
          <span class="desc">${c.descricao}<small>${ehAssin(c) ? 'Assinatura' : c.parcelas || '1/1'}${c.tipo ? ` · ${c.tipo}` : ''}${c.oculto ? ' · oculto' : ''}</small></span>
          <b>${brl(c.valor)}</b></li>`)}</ul>` : ''}
      </section>`) : html`<section class="vazio"><p class="sutil">Nenhum lançamento nesta fatura.</p></section>`}`);

  raiz.querySelectorAll('[data-mes]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.mes) { est.fatCartao = b.dataset.mes; ctx.redesenhar(); } }));
  raiz.querySelectorAll('[data-pessoa]').forEach((b) => b.addEventListener('click', () => {
    const p = b.dataset.pessoa;
    if (est.abertos.has(p)) est.abertos.delete(p); else est.abertos.add(p);
    ctx.redesenhar();
  }));
}
