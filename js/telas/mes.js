// Mês (igual à aba Mês do PC): referência do fechamento, Dívidas (tetos), Demonstrativos (receitas) e os gastos do mês.
// Tocar num gasto abre a edição; o mesmo lançamento no cartão acompanha.
import { html, montar, cru, brl, nomeMes, dataBR, dataCurta, hojeISO, lerValor, avisar, confirmar, norm } from '../comum/util.js';
import { resumoMes, diasRestantes, periodoFatura, operacaoDe, lerParcela } from '../comum/calculos.js';
import { cartaoDoGasto, garantirNoCartao } from '../comum/conciliar.js';
import { seletorMes, I } from '../ui.js';

const NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const v2 = (n) => (Number(n) || 0).toFixed(2).replace('.', ',');

export function render(est, raiz, ctx) {
  const d = est.dados;
  const ids = d.meses.map((m) => m.id);
  const mes = d.meses.find((m) => m.id === est.mesId);
  if (!mes) { montar(raiz, html`<section class="vazio"><h2>Nenhum mês ainda</h2><p class="sutil">Os meses criados no PC aparecem aqui.</p></section>`); return; }
  const rec = mes.receitas;
  rec.descontos = rec.descontos || []; rec.outras = rec.outras || [];
  mes.tetos = mes.tetos || {};
  const r = resumoMes(d, mes);
  const dias = diasRestantes(mes);
  const porDia = dias > 0 ? r.saldo / dias : null;
  const per = periodoFatura(d, mes);
  // attr é sempre um texto fixo do código (ex.: data-rec="extra"), por isso entra sem escapar
  const campo = (attr, valor) => html`<input class="num-campo" ${cru(attr)} value="${v2(valor)}" inputmode="decimal">`;
  const t = norm(est.buscaMes || '');
  const gastos = mes.gastos.filter((g) => !t || norm(g.descricao).includes(t) || norm(g.tipo).includes(t))
    .sort((a, b) => Number(!!a.oculto) - Number(!!b.oculto) || (b.data || '0').localeCompare(a.data || '0'));

  montar(raiz, html`
    ${seletorMes(ids, mes.id)}
    <p class="sutil pequeno centro">Compras de ${dataBR(per.inicio)} a ${dataBR(per.ultimoDia)} · fecha em ${dataBR(per.fim)}</p>

    <section class="cartao quadro-ref">
      <table class="tabela-ref">
        <tr><th>Dia de referência</th><td>${dataBR(hojeISO())}</td></tr>
        <tr><th>Mês de referência</th><td>${NOMES[Number(mes.id.slice(5, 7)) - 1]}</td></tr>
        <tr><th>Próxima ref (fechamento)</th><td><input type="date" data-ref value="${mes.proximaRef || ''}"></td></tr>
        <tr class="${dias != null && dias <= 0 ? 'negativo' : ''}"><th>Dias restantes</th><td>${dias == null ? '—' : String(dias)}</td></tr>
      </table>
    </section>

    <section class="cartao" id="quadros">
      <h3>Dívidas</h3>
      <table class="tabela-demo">
        <tr class="cab"><td>Tipo</td><td class="num">Valor</td><td class="num">Teto</td></tr>
        <tr><td>Crédito</td><td class="num">${brl(r.credito)}</td><td class="num">${campo('data-teto="credito"', mes.tetos.credito)}</td></tr>
        <tr><td>Débito</td><td class="num">${brl(r.debito)}</td><td class="num">${campo('data-teto="debito"', mes.tetos.debito)}</td></tr>
        <tr class="destaque-neg"><td>Total gasto</td><td class="num" colspan="2">${brl(r.gasto)}</td></tr>
        <tr><td>Teto total</td><td class="num" colspan="2">${brl((r.tetoCredito || 0) + (r.tetoDebito || 0))}</td></tr>
        <tr><td>Total ganho</td><td class="num" colspan="2">${brl(r.ganho)}</td></tr>
        <tr class="${r.saldo < 0 ? 'destaque-neg' : 'destaque-pos'}"><td>Saldo (PnL)</td><td class="num" colspan="2">${brl(r.saldo)}</td></tr>
      </table>

      <h3 class="mt">Demonstrativos</h3>
      <table class="tabela-demo">
        <tr><td>Valor cartão de crédito</td><td class="num">${brl(r.credito)}</td></tr>
        <tr><td>Gasto máximo por dia</td><td class="num">${porDia == null ? 'Fatura fechada' : brl(Math.max(0, porDia))}</td></tr>
        <tr><td>Salário mensal bruto</td><td class="num">${campo('data-rec="salarioBruto"', rec.salarioBruto)}</td></tr>
        ${rec.descontos.map((x, i) => html`<tr class="sub"><td><input data-desc-d="${i}" value="${x.descricao}" aria-label="Desconto"></td><td class="num">− ${campo(`data-desc-v="${i}"`, x.valor)}<button class="icone-btn pequeno" data-desc-x="${i}" aria-label="Remover desconto">${I.lixo}</button></td></tr>`)}
        <tr class="sub"><td colspan="2"><button class="btn link" data-acao="add-desconto">${I.mais} desconto do salário</button></td></tr>
        <tr class="total"><td>Salário mensal líquido</td><td class="num">${brl(r.liquido)}</td></tr>
        <tr><td>Alimentação</td><td class="num">${campo('data-rec="alimentacao"', rec.alimentacao)}</td></tr>
        <tr><td>Vale combustível</td><td class="num">${campo('data-rec="valeCombustivel"', rec.valeCombustivel)}</td></tr>
        ${rec.outras.map((x, i) => html`<tr><td><input data-out-d="${i}" value="${x.descricao}" aria-label="Receita"></td><td class="num">${campo(`data-out-v="${i}"`, x.valor)}<button class="icone-btn pequeno" data-out-x="${i}" aria-label="Remover receita">${I.lixo}</button></td></tr>`)}
        <tr class="sub"><td colspan="2"><button class="btn link" data-acao="add-receita">${I.mais} outra receita (fixa todo mês)</button></td></tr>
        <tr class="total"><td>Valor salário total</td><td class="num">${brl(r.salarioTotal)}</td></tr>
        <tr><td>Extra <span class="sutil">(só este mês)</span></td><td class="num">${campo('data-rec="extra"', rec.extra)}</td></tr>
        <tr class="total forte"><td>Valor total</td><td class="num">${brl(r.ganho)}</td></tr>
      </table>
    </section>

    <section class="cartao">
      <div class="cartao-topo"><h3>Gastos do mês</h3><span class="sutil">${mes.gastos.length}</span></div>
      <input type="search" id="busca-mes" placeholder="Buscar nome ou categoria…" value="${est.buscaMes || ''}" aria-label="Buscar">
      ${gastos.length ? html`<ul class="lista-gastos">${gastos.map((g) => html`<li class="tocavel ${g.oculto ? 'oculto' : ''} ${/^fixo$/i.test(g.parcela || '') ? 'assinatura' : ''}" data-editar="${g.id}">
        <span class="data">${g.data ? dataCurta(g.data) : '—'}</span>
        <span class="desc">${g.descricao}<small>${g.tipo || 'Sem categoria'} · ${g.tipo ? operacaoDe(d, g.tipo) : 'Crédito'}${g.parcela && g.parcela !== '1/1' ? ` · ${g.parcela}` : ''}${g.oculto ? ' · oculto' : ''}</small></span>
        <b>${brl(g.valor)}</b></li>`)}</ul>` : html`<p class="sutil">Nenhum gasto${t ? ' com essa busca' : ''}.</p>`}
      <p class="sutil pequeno">Toque num gasto para editar. O mesmo lançamento no cartão acompanha.</p>
    </section>`);

  raiz.querySelectorAll('[data-mes]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.mes) { est.mesId = b.dataset.mes; ctx.redesenhar(); } }));

  // campos dos quadros: grava ao sair do campo (ou Enter) e recalcula
  const gravar = (el) => {
    const ds = el.dataset;
    if (ds.ref !== undefined) { if (el.value) mes.proximaRef = el.value; return true; }
    if (ds.descD !== undefined) { rec.descontos[ds.descD].descricao = el.value.trim(); return true; }
    if (ds.outD !== undefined) { rec.outras[ds.outD].descricao = el.value.trim(); return true; }
    const v = el.value.trim() === '' ? 0 : lerValor(el.value);
    if (!Number.isFinite(v)) { avisar('Valor inválido. Use números, ex.: 400 ou 400,50.', 'erro'); return false; }
    if (ds.rec) rec[ds.rec] = v;
    else if (ds.teto) mes.tetos[ds.teto] = v;
    else if (ds.descV !== undefined) rec.descontos[ds.descV].valor = v;
    else if (ds.outV !== undefined) rec.outras[ds.outV].valor = v;
    else return false;
    return true;
  };
  raiz.onchange = async (e) => {
    const el = e.target;
    if (el.id === 'busca-mes' || !el.matches('input')) return;
    if (gravar(el)) { await ctx.salvar(); ctx.redesenhar(); }
  };
  raiz.onkeydown = (e) => { if (e.key === 'Enter' && e.target.matches('#quadros input, .quadro-ref input')) { e.preventDefault(); e.target.blur(); } };
  raiz.querySelectorAll('.num-campo').forEach((i) => i.addEventListener('focus', () => setTimeout(() => i.select(), 0)));
  const busca = raiz.querySelector('#busca-mes');
  let espera;
  busca.addEventListener('input', () => { est.buscaMes = busca.value; clearTimeout(espera); espera = setTimeout(() => { ctx.redesenhar(); const b = document.querySelector('#busca-mes'); if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); } }, 300); });
  raiz.onclick = async (e) => {
    const b = e.target.closest('[data-desc-x],[data-out-x],[data-acao]');
    if (b) {
      if (b.dataset.descX !== undefined) rec.descontos.splice(Number(b.dataset.descX), 1);
      else if (b.dataset.outX !== undefined) rec.outras.splice(Number(b.dataset.outX), 1);
      else if (b.dataset.acao === 'add-desconto') rec.descontos.push({ descricao: 'Desconto', valor: 0 });
      else if (b.dataset.acao === 'add-receita') rec.outras.push({ descricao: 'Nova receita', valor: 0 });
      else return;
      await ctx.salvar(); ctx.redesenhar(); return;
    }
    const li = e.target.closest('[data-editar]');
    if (li) { const g = mes.gastos.find((x) => x.id === li.dataset.editar); if (g) editarGasto(est, ctx, mes, g); }
  };
}

// ---------- editar um gasto do mês (o lançamento do cartão acompanha) ----------
function editarGasto(est, ctx, mes, g) {
  const d = est.dados;
  const noCartao = cartaoDoGasto(d, mes, g); // procurado ANTES de mudar
  const cats = [...d.categorias].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const fundo = document.createElement('div');
  fundo.className = 'modal-fundo';
  montar(fundo, html`<form class="modal editar" autocomplete="off" role="dialog" aria-modal="true" aria-label="Editar gasto">
    <h3>Editar gasto · ${nomeMes(mes.id)}</h3>
    <p class="sutil pequeno">${noCartao ? html`O lançamento do cartão (<b>${noCartao.descricao}</b>) acompanha.` : 'Este gasto não está no cartão (débito, ou ainda não ligado).'}</p>
    <label>Nome<input name="descricao" value="${g.descricao}" maxlength="120" required></label>
    <div class="duas"><label>Data<input name="data" type="date" value="${g.data || ''}"></label><label>Valor<input name="valor" inputmode="decimal" value="${v2(g.valor)}" required></label></div>
    <div class="duas"><label>Parcela<input name="parcela" value="${g.parcela || '1/1'}" maxlength="10" placeholder="1/1 ou Fixo"></label>
      <label>Categoria<select name="tipo"><option value="">— sem categoria —</option>${cats.map((c) => html`<option value="${c.nome}" ${c.nome === g.tipo ? 'selected' : ''}>${c.nome}</option>`)}</select></label></div>
    <label class="linha-check"><input type="checkbox" name="oculto" ${g.oculto ? 'checked' : ''}> Ocultar (fica apagadinho e não soma)</label>
    <div class="acoes"><button type="button" class="btn" data-r="cancelar">Cancelar</button><button type="submit" class="btn primario">${I.check} Salvar</button></div>
    <button type="button" class="btn perigo" data-r="apagar">${I.lixo} Apagar gasto</button>
  </form>`);
  document.body.append(fundo);
  const f = fundo.querySelector('form');
  const fechar = () => fundo.remove();
  fundo.addEventListener('click', (e) => { if (e.target === fundo || e.target.closest('[data-r=cancelar]')) fechar(); });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const valor = lerValor(f.valor.value);
    const parcela = f.parcela.value.trim() || '1/1';
    if (!Number.isFinite(valor)) return avisar('Valor inválido.', 'erro');
    if (!/^fixo$/i.test(parcela) && !lerParcela(parcela)) return avisar('Parcela deve ser "Fixo" ou no formato 1/3.', 'erro');
    if (!f.descricao.value.trim()) return avisar('Preencha o nome.', 'erro');
    Object.assign(g, { descricao: f.descricao.value.trim(), data: f.data.value, valor, parcela, tipo: f.tipo.value, oculto: f.oculto.checked });
    let msg = 'Gasto atualizado.';
    if (noCartao && operacaoDe(d, g.tipo) === 'Débito') { d.cartao = d.cartao.filter((c) => c !== noCartao); msg = 'Atualizado. Como agora é débito, saiu do cartão.'; }
    else if (noCartao) { Object.assign(noCartao, { descricao: g.descricao, valor: g.valor, parcelas: g.parcela, oculto: !!g.oculto }); if (g.data) noCartao.data = g.data; if (g.tipo) noCartao.tipo = g.tipo; msg = 'Atualizado no mês e no cartão.'; }
    else if (garantirNoCartao(d, mes, g)) msg = 'Atualizado. Como é crédito, entrou no cartão também.';
    fechar();
    await ctx.salvar();
    avisar(msg);
    ctx.redesenhar();
  });
  fundo.querySelector('[data-r=apagar]').addEventListener('click', async () => {
    if (!(await confirmar('Apagar gasto?', `"${g.descricao}" — ${brl(g.valor)}${noCartao ? ' (apaga também do cartão)' : ''}.`, 'Apagar', true))) return;
    mes.gastos = mes.gastos.filter((x) => x !== g);
    if (noCartao) d.cartao = d.cartao.filter((c) => c !== noCartao);
    fechar();
    await ctx.salvar();
    avisar('Gasto apagado.');
    ctx.redesenhar();
  });
}
