// Lançar um gasto na rua. Mesmas regras do PC: seu gasto vai para o mês (e para o cartão, se for crédito);
// gasto de outra pessoa vai só para o cartão. Nada é duplicado.
import { html, montar, $, brl, nomeMes, lerValor, avisar, confirmar, hojeISO, norm } from '../comum/util.js';
import { faturaDaCompra, operacaoDe, mapaAprendido, sugerirCategoria } from '../comum/calculos.js';
import { chaveNome } from '../comum/conciliar.js';
import { assinaturaConhecida } from '../comum/assinaturas.js';
import { classificar, aplicar } from '../comum/lancamentos.js';
import { I } from '../ui.js';

const novoForm = (d, antigo) => ({ valor: '', descricao: '', data: antigo?.data || hojeISO(), tipo: '', parcelas: '1', quem: antigo?.quem || d.config.pessoaPadrao, catManual: false });

export function render(est, raiz, ctx) {
  const d = est.dados;
  const f = est.form || (est.form = novoForm(d));
  est.lancadosAgora = est.lancadosAgora || [];
  const cats = [...d.categorias].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const nomes = [...new Set([...d.meses.slice(-4).flatMap((m) => m.gastos.map((g) => g.descricao)), ...d.cartao.slice(-300).map((c) => c.descricao)].filter(Boolean))].slice(-400);
  let mapa = null;

  montar(raiz, html`
    <form class="form-lancar" id="form" autocomplete="off">
      <label class="valor-grande"><span>R$</span><input id="valor" inputmode="decimal" placeholder="0,00" value="${f.valor}" aria-label="Valor" enterkeyhint="next"></label>
      <label>Descrição<input id="descricao" list="nomes" value="${f.descricao}" placeholder="Ex.: Mercado, Uber, Posto…" maxlength="120" enterkeyhint="done" autocapitalize="sentences"></label>
      <datalist id="nomes">${nomes.map((n) => html`<option value="${n}">`)}</datalist>
      <div class="duas">
        <label>Data<input id="data" type="date" value="${f.data}"></label>
        <label>Parcelas<select id="parcelas">
          <option value="1" ${f.parcelas === '1' ? 'selected' : ''}>À vista</option>
          ${Array.from({ length: 23 }, (_, i) => String(i + 2)).map((n) => html`<option value="${n}" ${f.parcelas === n ? 'selected' : ''}>${n}x</option>`)}
          <option value="fixo" ${f.parcelas === 'fixo' ? 'selected' : ''}>Assinatura (todo mês)</option>
        </select></label>
      </div>
      <label>Categoria<select id="tipo"><option value="">— escolha —</option>${cats.map((c) => html`<option value="${c.nome}" ${c.nome === f.tipo ? 'selected' : ''}>${c.nome}${c.operacao === 'Débito' ? ' (débito)' : ''}</option>`)}</select></label>
      <div class="rotulo">De quem é</div>
      <div class="chips" id="quem">${d.config.pessoas.map((p) => html`<button type="button" class="chip ${p === f.quem ? 'ativo' : ''}" data-p="${p}">${p}</button>`)}</div>
      <p class="info-destino" id="destino-info"></p>
      <button class="btn primario grande" type="submit">${I.check} Lançar</button>
    </form>
    ${est.lancadosAgora.length ? html`<section class="cartao"><h3>Lançados agora</h3><ul class="lista-gastos">${est.lancadosAgora.map((l, i) => html`<li><span class="desc">${l.descricao}<small>${l.onde}</small></span><b>${brl(l.valor)}</b><button class="icone-btn pequeno" data-desfazer="${i}" aria-label="Desfazer">${I.lixo}</button></li>`)}</ul></section>` : ''}`);

  const destinoDe = () => faturaDaCompra(d, f.data) || faturaDaCompra(d, hojeISO());
  function info() {
    const eu = f.quem === d.config.pessoaPadrao;
    const debito = f.tipo && operacaoDe(d, f.tipo) === 'Débito';
    const n = f.parcelas === 'fixo' ? 0 : Number(f.parcelas);
    const v = lerValor(f.valor);
    const onde = eu ? (debito ? 'no seu mês (débito)' : 'no seu mês e no cartão') : `só no cartão (de ${f.quem})`;
    $('#destino-info').textContent = `Fatura de ${nomeMes(destinoDe())} · ${onde}${n > 1 && Number.isFinite(v) ? ` · ${n}x de ${brl(v)} = ${brl(v * n)}` : ''}`;
    $('#valor').closest('label').querySelector('span').textContent = n > 1 ? 'R$/parcela' : 'R$';
  }
  info();

  function sugerir() {
    if (f.catManual || !f.descricao) return;
    const ap = (d.apelidos || {})[chaveNome(f.descricao)];
    const assin = assinaturaConhecida(d, f.descricao, f.valor.trim() && Number.isFinite(lerValor(f.valor)) ? lerValor(f.valor) : null);
    let tipo = '';
    if (assin) {
      tipo = cats.find((c) => norm(c.nome) === 'assinatura')?.nome || '';
      f.parcelas = 'fixo'; $('#parcelas').value = 'fixo';
      if (!f.valor && assin.valor) { f.valor = assin.valor.toFixed(2).replace('.', ','); $('#valor').value = f.valor; }
    } else if (ap && ap.tipo && !ap.catConflito) tipo = ap.tipo;
    else { mapa = mapa || mapaAprendido(d); tipo = sugerirCategoria(d, mapa, f.descricao); }
    if (tipo && cats.some((c) => c.nome === tipo)) { f.tipo = tipo; $('#tipo').value = tipo; }
  }

  $('#valor').addEventListener('input', (e) => { f.valor = e.target.value.replace(/[^\d,.]/g, ''); info(); });
  $('#descricao').addEventListener('input', (e) => { f.descricao = e.target.value; });
  $('#descricao').addEventListener('change', () => { sugerir(); info(); });
  $('#data').addEventListener('change', (e) => { f.data = e.target.value || hojeISO(); info(); });
  $('#parcelas').addEventListener('change', (e) => { f.parcelas = e.target.value; info(); });
  $('#tipo').addEventListener('change', (e) => { f.tipo = e.target.value; f.catManual = true; info(); });
  $('#quem').addEventListener('click', (e) => {
    const b = e.target.closest('[data-p]'); if (!b) return;
    f.quem = b.dataset.p;
    raiz.querySelectorAll('#quem .chip').forEach((x) => x.classList.toggle('ativo', x === b));
    info();
  });
  $('#valor').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#descricao').focus(); } });

  $('#form').addEventListener('submit', async (e) => {
    e.preventDefault();
    document.activeElement?.blur();
    const valor = lerValor(f.valor);
    const descricao = f.descricao.trim();
    if (!Number.isFinite(valor) || valor === 0) return avisar('Digite o valor.', 'erro');
    if (!descricao) return avisar('Digite a descrição.', 'erro');
    if (!f.tipo && f.quem === d.config.pessoaPadrao && !(await confirmar('Sem categoria?', 'Este gasto vai sem categoria (conta como crédito). Você pode escolher depois no PC.', 'Lançar assim'))) return;
    const n = f.parcelas === 'fixo' ? 0 : Number(f.parcelas);
    const x = { data: f.data, descricao, valor, parcela: f.parcelas === 'fixo' ? 'Fixo' : n > 1 ? `1/${n}` : '1/1', tipo: f.tipo, quem: f.quem, marcado: true, origem: 'celular', acao: null };
    const destino = destinoDe();
    classificar(d, destino, [x]);
    let forcar = false;
    if (x.acao === 'existe') {
      if (!(await confirmar('Parece que já foi lançado', `Achei "${x.alvoDescricao}" com o mesmo valor e data. Lançar outro mesmo assim?`, 'Lançar outro'))) return;
      forcar = true;
    }
    const antesM = new Set(d.meses.flatMap((m) => m.gastos.map((g) => g.id)));
    const antesC = new Set(d.cartao.map((c) => c.id));
    const mesesAntes = new Set(d.meses.map((m) => m.id));
    let mes;
    if (forcar) {
      mes = aplicar(d, destino, []).mes; // garante que o mês existe
      const id = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
      const eu = x.quem === d.config.pessoaPadrao;
      if (eu) mes.gastos.push({ id: id(), data: x.data, descricao, valor, parcela: x.parcela, tipo: x.tipo, origem: 'celular' });
      if (!eu || operacaoDe(d, x.tipo) !== 'Débito') d.cartao.push({ id: id(), data: x.data, quem: x.quem, descricao, valor, pgto: 0, parcelas: x.parcela, ...(x.tipo ? { tipo: x.tipo } : {}) });
    } else mes = aplicar(d, destino, [x]).mes;
    const novosM = d.meses.flatMap((m) => m.gastos.filter((g) => !antesM.has(g.id)).map((g) => ({ mes: m.id, id: g.id })));
    const novosC = d.cartao.filter((c) => !antesC.has(c.id)).map((c) => c.id);
    const criouMes = !mesesAntes.has(mes.id);
    const onde = x.acao === 'completar' ? `completou "${x.alvoDescricao}"` : [novosM.length ? 'mês' : '', novosC.length ? 'cartão' : ''].filter(Boolean).join(' + ') || 'nada novo';
    est.lancadosAgora.unshift({ descricao, valor, onde: `${nomeMes(mes.id)} · ${onde}`, novosM: criouMes ? [] : novosM, novosC: criouMes ? [] : novosC });
    est.lancadosAgora = est.lancadosAgora.slice(0, 10);
    est.form = novoForm(d, f);
    await ctx.salvar();
    avisar(x.acao === 'completar' ? `Completei "${x.alvoDescricao}" em ${nomeMes(mes.id)}.` : `Lançado em ${nomeMes(mes.id)}.`);
    navigator.vibrate?.(15);
    ctx.redesenhar();
  });

  raiz.querySelectorAll('[data-desfazer]').forEach((b) => b.addEventListener('click', async () => {
    const l = est.lancadosAgora[Number(b.dataset.desfazer)];
    if (!l.novosM.length && !l.novosC.length) return avisar('Este não dá para desfazer aqui (criou o mês novo ou só completou um lançamento). Ajuste no PC.', 'erro');
    if (!(await confirmar('Desfazer?', `Apaga "${l.descricao}" (${brl(l.valor)}) que você acabou de lançar.`, 'Apagar', true))) return;
    for (const g of l.novosM) { const m = d.meses.find((y) => y.id === g.mes); if (m) m.gastos = m.gastos.filter((y) => y.id !== g.id); }
    d.cartao = d.cartao.filter((c) => !l.novosC.includes(c.id));
    est.lancadosAgora.splice(Number(b.dataset.desfazer), 1);
    await ctx.salvar();
    ctx.redesenhar();
  }));
}
