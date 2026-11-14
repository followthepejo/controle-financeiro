// Cartão compartilhado, por pessoa, na fatura escolhida (igual à tabela dinâmica da planilha).
// Tocar num lançamento abre a edição (nome, data, valor, parcela, categoria, dono, ocultar, apagar).
// Se o lançamento é seu, o mesmo gasto do seu mês é atualizado junto.
import { html, montar, brl, dataCurta, somarMes, hojeISO, nomeMes, lerValor, avisar, confirmar } from '../comum/util.js';
import { faturaDaCompra, lerParcela } from '../comum/calculos.js';
import { acharNoMes } from '../comum/conciliar.js';
import { aplicar } from '../comum/lancamentos.js';
import { assinaturaConhecida } from '../comum/assinaturas.js';
import { seletorMes, barra, I } from '../ui.js';

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
    <p class="sutil pequeno centro">Toque num lançamento para editar.</p>
    ${grupos.length ? grupos.map((g) => html`
      <section class="cartao pessoa ${est.abertos.has(g.p) ? 'aberto' : ''}">
        <button class="pessoa-topo" data-pessoa="${g.p}">
          <span>${g.p}<small>${g.lista.length} ${g.lista.length === 1 ? 'compra' : 'compras'}</small></span>
          <b>${brl(g.total)}</b>
        </button>
        ${barra(totalGeral ? g.total / totalGeral : 0, false)}
        ${est.abertos.has(g.p) ? html`<ul class="lista-gastos">${g.lista.map((c) => html`<li class="tocavel ${c.oculto ? 'oculto' : ''} ${ehAssin(c) ? 'assinatura' : ''}" data-editar="${c.id}">
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
  raiz.querySelectorAll('[data-editar]').forEach((li) => li.addEventListener('click', () => {
    const x = d.cartao.find((c) => c.id === li.dataset.editar);
    if (x) editar(est, ctx, x);
  }));
}

// ---------- edição (janela de baixo para cima) ----------
function editar(est, ctx, x) {
  const d = est.dados;
  const eu = d.config.pessoaPadrao;
  const fatData = (dt) => faturaDaCompra(d, dt);
  const ligado = x.quem === eu ? acharNoMes(d, x, fatData) : null; // o mesmo gasto no seu mês (procurado ANTES de mudar)
  const cats = [...d.categorias].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const fundo = document.createElement('div');
  fundo.className = 'modal-fundo';
  montar(fundo, html`<form class="modal editar" autocomplete="off" role="dialog" aria-modal="true" aria-label="Editar lançamento">
    <h3>Editar lançamento</h3>
    ${x.quem === eu ? html`<p class="sutil pequeno">${ligado ? html`Também atualiza no seu mês de ${nomeMes(ligado.mes.id)}: <b>${ligado.gasto.descricao}</b>.` : 'Não achei este gasto no seu mês: muda só no cartão.'}</p>` : ''}
    <label>Nome<input name="descricao" value="${x.descricao}" maxlength="120" required></label>
    <div class="duas"><label>Data<input name="data" type="date" value="${x.data}" required></label><label>Valor<input name="valor" inputmode="decimal" value="${x.valor.toFixed(2).replace('.', ',')}" required></label></div>
    <div class="duas"><label>Parcela<input name="parcelas" value="${x.parcelas || '1/1'}" maxlength="10" placeholder="1/1 ou Fixo"></label>
      <label>De quem<select name="quem">${[...new Set([...d.config.pessoas, x.quem])].map((p) => html`<option ${p === x.quem ? 'selected' : ''}>${p}</option>`)}</select></label></div>
    <label>Categoria<select name="tipo"><option value="">— sem categoria —</option>${cats.map((c) => html`<option value="${c.nome}" ${c.nome === (x.tipo || ligado?.gasto.tipo) ? 'selected' : ''}>${c.nome}</option>`)}</select></label>
    <label class="linha-check"><input type="checkbox" name="oculto" ${x.oculto ? 'checked' : ''}> Ocultar (fica apagadinho e não soma)</label>
    <div class="acoes"><button type="button" class="btn" data-r="cancelar">Cancelar</button><button type="submit" class="btn primario">${I.check} Salvar</button></div>
    <button type="button" class="btn perigo" data-r="apagar">${I.lixo} Apagar lançamento</button>
  </form>`);
  document.body.append(fundo);
  const f = fundo.querySelector('form');
  const fechar = () => fundo.remove();
  fundo.addEventListener('click', (e) => { if (e.target === fundo || e.target.closest('[data-r=cancelar]')) fechar(); });

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const valor = lerValor(f.valor.value);
    const parcelas = f.parcelas.value.trim() || '1/1';
    if (!Number.isFinite(valor)) return avisar('Valor inválido.', 'erro');
    if (!/^fixo$/i.test(parcelas) && !lerParcela(parcelas)) return avisar('Parcela deve ser "Fixo" ou no formato 1/3.', 'erro');
    const novo = { descricao: f.descricao.value.trim(), data: f.data.value, valor, parcelas, tipo: f.tipo.value, quem: f.quem.value, oculto: f.oculto.checked };
    if (!novo.descricao || !novo.data) return avisar('Preencha nome e data.', 'erro');
    const virouDeOutro = x.quem === eu && novo.quem !== eu;
    const virouMeu = x.quem !== eu && novo.quem === eu;
    if (virouDeOutro && ligado && !(await confirmar('Não é mais seu?', `"${ligado.gasto.descricao}" sai do seu mês de ${nomeMes(ligado.mes.id)} e fica só no cartão, como de ${novo.quem}.`, 'Confirmar'))) return;
    Object.assign(x, { descricao: novo.descricao, data: novo.data, valor: novo.valor, parcelas: novo.parcelas, quem: novo.quem, oculto: novo.oculto });
    if (novo.tipo) x.tipo = novo.tipo; else delete x.tipo;
    let msg = 'Lançamento atualizado no cartão.';
    if (virouDeOutro && ligado) {
      ligado.mes.gastos = ligado.mes.gastos.filter((g) => g !== ligado.gasto);
      msg = `Agora é de ${novo.quem}: saiu do seu mês.`;
    } else if (ligado) {
      Object.assign(ligado.gasto, { descricao: novo.descricao, data: novo.data, valor: novo.valor, parcela: novo.parcelas, oculto: novo.oculto });
      if (novo.tipo) ligado.gasto.tipo = novo.tipo;
      msg = 'Atualizado no cartão e no seu mês.';
    } else if (virouMeu) {
      const destino = faturaDaCompra(d, novo.data);
      if (destino) { aplicar(d, destino, [{ ...novo, parcela: novo.parcelas, quem: eu, acao: 'novo', origem: 'celular', marcado: true }]); msg = `Agora é seu: entrou no seu mês de ${nomeMes(destino)}.`; }
    }
    fechar();
    await ctx.salvar();
    avisar(msg);
    ctx.redesenhar();
  });

  fundo.querySelector('[data-r=apagar]').addEventListener('click', async () => {
    const texto = ligado ? `Apaga "${x.descricao}" (${brl(x.valor)}) do cartão e do seu mês de ${nomeMes(ligado.mes.id)}.` : `Apaga "${x.descricao}" (${brl(x.valor)}) do cartão.`;
    if (!(await confirmar('Apagar lançamento?', texto, 'Apagar', true))) return;
    d.cartao = d.cartao.filter((c) => c !== x);
    if (ligado) ligado.mes.gastos = ligado.mes.gastos.filter((g) => g !== ligado.gasto);
    fechar();
    await ctx.salvar();
    avisar('Lançamento apagado.');
    ctx.redesenhar();
  });
}
