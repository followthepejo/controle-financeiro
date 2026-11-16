// GERADO por scripts/montar-celular.js a partir de app/renderer/js — não edite aqui.
// Junta vários prints, descobre compras cortadas que não apareceram inteiras em nenhum print
// e confere cada compra lida com o que já existe no mês (para completar sem duplicar).
import { norm, brl, dataBR, somarMes } from './util.js';
import { criarProximoMes, fechamentoDe, operacaoDe, periodoFatura, faturaDaCompra } from './calculos.js';

const descChave = (s) => norm(s).replace(/[^a-z0-9]/g, '').slice(0, 14);
const chaveItem = (l) => `${l.data}|${Number(l.valor).toFixed(2)}|${descChave(l.descricao)}`;
const resumo = (l) => `“${l.descricao}” · ${brl(l.valor)}${l.data ? ` · ${dataBR(l.data).slice(0, 5)}` : ''}`;

// q é a continuação de p para baixo (ou para cima)? Só vale para prints sem compras em comum.
// Usa a ordem das datas na lista (o app do banco lista da mais nova para a mais antiga, ou o contrário)
// e, se as datas empatarem, a ordem em que os prints foram enviados.
function continuacao(p, q, pi, qi, lado) {
  if (!p.lista.length || !q.lista.length) return false;
  const chavesP = new Set(p.lista.map((l) => l.chave));
  if (q.lista.some((l) => chavesP.has(l.chave))) return false;
  const datas = [...p.lista, ...q.lista].map((l) => l.data).filter(Boolean);
  const desc = datas.length < 2 || datas[0] >= datas.at(-1); // lista em ordem decrescente?
  const limiteP = lado === 'baixo' ? p.lista.at(-1).data : p.lista[0].data;
  const pontaQ = lado === 'baixo' ? q.lista[0].data : q.lista.at(-1).data;
  if (!limiteP || !pontaQ) return lado === 'baixo' ? qi > pi : qi < pi;
  if (limiteP === pontaQ) return lado === 'baixo' ? qi > pi : qi < pi;
  const depoisNaLista = desc ? pontaQ < limiteP : pontaQ > limiteP;
  return lado === 'baixo' ? depoisNaLista : !depoisNaLista;
}

// resultados: [{ lancamentos: [...com ordem], cortados: [...] }] na ordem dos prints
export function juntarPrints(resultados) {
  const porPrint = resultados.map((res) => {
    const vistos = new Map();
    const lista = [...(res.lancamentos || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).map((l) => {
      const k = chaveItem(l);
      const n = (vistos.get(k) || 0) + 1; vistos.set(k, n);
      return { ...l, chave: `${k}#${n}` }; // #n: duas compras iguais no mesmo print continuam sendo duas
    });
    return { lista, cortados: res.cortados || [] };
  });

  // União sem repetir o que aparece em mais de um print
  const itens = []; const vistas = new Set();
  porPrint.forEach((p, pi) => p.lista.forEach((l) => {
    if (vistas.has(l.chave)) return;
    // mesma data, mesmo valor e nome parecido vindo de OUTRO print = a mesma compra lida duas vezes
    const repetida = itens.find((y) => y.print !== pi && y.data === l.data && valorIgual(y.valor, l.valor) && (parecido(y.descricao, l.descricao) || descChave(y.descricao).slice(0, 4) === descChave(l.descricao).slice(0, 4)));
    if (repetida) return;
    vistas.add(l.chave); itens.push({ ...l, print: pi });
  }));

  // Compra cortada: só conta como "enviada" se outro print a mostrar inteira.
  const faltas = [];
  porPrint.forEach((p, pi) => {
    for (const c of p.cortados) {
      const antes = c.depoisDe != null ? p.lista[c.depoisDe] : null;
      const depois = c.antesDe != null ? p.lista[c.antesDe] : null;
      const outros = porPrint.filter((_, j) => j !== pi);
      let coberto = false;
      if (antes && depois) {
        // algo apareceu entre as duas vizinhas em outro print
        coberto = outros.some((q) => { const j = q.lista.findIndex((l) => l.chave === antes.chave); return j >= 0 && q.lista[j + 1] && q.lista[j + 1].chave !== depois.chave; });
      } else if (antes) {
        // (a) outro print mostra a vizinha seguida de outra compra; ou
        // (b) outro print, sem compras em comum, é a continuação para baixo e começa limpo (sem corte em cima)
        coberto = porPrint.some((q, qi) => {
          if (qi === pi) return false;
          const j = q.lista.findIndex((l) => l.chave === antes.chave);
          if (j >= 0) return j < q.lista.length - 1;
          return continuacao(p, q, pi, qi, 'baixo') && !q.cortados.some((x) => x.posicao === 'inicio');
        });
      } else if (depois) {
        coberto = porPrint.some((q, qi) => {
          if (qi === pi) return false;
          const j = q.lista.findIndex((l) => l.chave === depois.chave);
          if (j >= 0) return j > 0;
          return continuacao(p, q, pi, qi, 'cima') && !q.cortados.some((x) => x.posicao === 'fim');
        });
      }
      if (coberto) continue;
      const onde = antes && depois ? `entre ${resumo(antes)} e ${resumo(depois)}`
        : antes ? `logo depois de ${resumo(antes)}` : depois ? `logo antes de ${resumo(depois)}` : 'sem nenhuma compra inteira ao lado';
      const pista = [c.dataVista ? `data ${dataBR(c.dataVista).slice(0, 5)}` : '', c.textoVisto ? `“${c.textoVisto}”` : ''].filter(Boolean).join(', ');
      const lugar = c.posicao === 'fim' ? 'embaixo' : c.posicao === 'inicio' ? 'em cima' : 'no meio';
      faltas.push({ print: pi + 1, posicao: c.posicao, texto: c.semDescricao
        ? `Print ${pi + 1} (${lugar}): não consegui ler o nome da compra de ${brl(c.valorVisto)}${c.dataVista ? ` (${dataBR(c.dataVista).slice(0, 5)})` : ''}, ${onde}. Lance essa à mão na aba Mês.`
        : `Print ${pi + 1} (${lugar}): uma compra ficou cortada ${onde}${pista ? ` — dá para ver ${pista}` : ''}.` });
    }
  });
  return { itens, faltas };
}

// Mês de destino; se ainda não existe, simula como ficaria (com fixos e parcelas do mês anterior)
export function mesAlvo(dados, destino) {
  const existe = dados.meses.find((m) => m.id === destino);
  if (existe) return { mes: existe, novo: false };
  const ant = dados.meses.find((m) => m.id === somarMes(destino, -1));
  const mes = ant ? criarProximoMes(ant).mes
    : { id: destino, proximaRef: fechamentoDe(dados, destino), receitas: { salarioBruto: 0, alimentacao: 0, valeCombustivel: 0, extra: 0, descontos: [] }, tetos: { credito: 2000, debito: 500 }, gastos: [] };
  return { mes, novo: true };
}

const tokens = (s) => new Set(norm(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3));
export function parecido(a, b) {
  const ta = tokens(a); const tb = tokens(b);
  for (const t of ta) if (tb.has(t)) return true;
  const ca = descChave(a); const cb = descChave(b);
  if (ca.length >= 3 && cb.length >= 3 && (ca.includes(cb.slice(0, 3)) || cb.includes(ca.slice(0, 3)))) return true;
  return false;
}
// Mesmo valor, ou diferença de centavos (o banco às vezes cobra R$ 0,01–0,10 diferente do registrado)
// desde que seja a mesma parcela/assinatura e o nome seja parecido.
const valorIgual = (a, b) => Math.abs(a - b) < 0.01;
function valorPerto(a, b) { const dif = Math.abs(a - b); return dif < 0.01 || dif <= Math.max(1, 0.03 * Math.max(Math.abs(a), Math.abs(b))); }
const mesmaParcela = (p1, p2) => { const a = String(p1 || '').replace(/\s/g, ''); const b = String(p2 || '').replace(/\s/g, ''); return !!a && a === b && a !== '1/1'; };
export const chaveNome = (s) => norm(s).replace(/[^a-z0-9]/g, '');

const totalParcela = (p) => { const m = String(p || '').match(/^\s*\d+\s*\/\s*(\d+)\s*$/); return m ? Number(m[1]) : null; };
const diasEntre = (a, b) => Math.abs((new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00')) / 86400000);

// Marca cada item com acao: 'novo' | 'completar' | 'existe'
export function conciliar(mes, itens) {
  const usados = new Set();
  const mesmoValor = (g, x) => valorIgual(g.valor, x.valor)
    || (valorPerto(g.valor, x.valor) && parecido(g.descricao, x.descricao) && (mesmaParcela(g.parcela, x.parcela) || /^fixo$/i.test(g.parcela || '') || (!g.data && totalParcela(g.parcela) && totalParcela(g.parcela) === totalParcela(x.parcela))));
  for (const x of itens) {
    x.acao = 'novo'; x.alvo = null; x.completa = []; x.provavel = false;
    if (x.pagamento) continue;
    const livres = mes.gastos.filter((g) => !usados.has(g.id) && mesmoValor(g, x));
    // 1) mesma data e mesmo valor: já está lá
    let g = livres.find((y) => y.data && y.data === x.data);
    // 2) já lançado sem data (fixos/parcelas que vieram do mês anterior): completa
    if (!g) {
      const semData = livres.filter((y) => !y.data);
      g = semData.find((y) => parecido(y.descricao, x.descricao))
        || semData.find((y) => totalParcela(y.parcela) && totalParcela(y.parcela) === totalParcela(x.parcela))
        || (semData.length === 1 && livres.length === 1 ? semData[0] : null);
    }
    // 3) mesmo valor, nome parecido e data próxima: já está lá
    if (!g) g = livres.find((y) => y.data && x.data && diasEntre(y.data, x.data) <= 3 && parecido(y.descricao, x.descricao));
    // 4) o banco usa outro nome ("Apple.Com/Bill" = Capcut Pro, "Infpay* 6411…" = Coca MCAR): mesmo valor EXATO,
    //    até 2 dias de diferença e um único candidato. Valor redondo (R$ 5,00, 30,00) repete demais: não vale.
    //    Fica como "provavelmente já lançado" (desmarcado) — se for outra compra, é só marcar.
    if (!g && x.data && Math.round(Math.abs(x.valor) * 100) % 100 !== 0) {
      const cand = livres.filter((y) => valorIgual(y.valor, x.valor) && y.data && diasEntre(y.data, x.data) <= 2);
      if (cand.length === 1) {
        g = cand[0];
        usados.add(g.id);
        x.alvo = g.id; x.acao = 'existe'; x.provavel = true; x.completa = [];
        x.alvoDescricao = g.descricao; x.diasDif = diasEntre(g.data, x.data);
        continue;
      }
    }
    if (!g) continue;
    usados.add(g.id);
    x.alvo = g.id;
    if (!g.data && x.data) x.completa.push('data');
    if (!g.tipo && x.tipo) x.completa.push('categoria');
    if (!g.parcela && x.parcela) x.completa.push('parcela');
    if (!valorIgual(g.valor, x.valor)) x.completa.push('valor');
    x.acao = x.completa.length ? 'completar' : 'existe';
    x.alvoDescricao = g.descricao;
  }
  return itens;
}

// Gasto do seu mês que corresponde a um lançamento do cartão (mesma fatura).
export function acharNoMes(dados, x, faturaDe) {
  const mes = dados.meses.find((m) => m.id === faturaDe(x.data));
  if (!mes) return null;
  const g = mes.gastos.find((y) => valorIgual(y.valor, x.valor) && y.data && y.data === x.data)
    || mes.gastos.find((y) => valorIgual(y.valor, x.valor) && parecido(y.descricao, x.descricao) && (!y.data || !x.data || mesmaParcela(y.parcela, x.parcelas)))
    || mes.gastos.find((y) => valorPerto(y.valor, x.valor) && mesmaParcela(y.parcela, x.parcelas) && parecido(y.descricao, x.descricao))
    || mes.gastos.find((y) => parecido(y.descricao, x.descricao) && mesmaParcela(y.parcela, x.parcelas)) // ex.: parcela lançada com outro valor no mês
    || mes.gastos.find((y) => valorIgual(y.valor, x.valor) && parecido(y.descricao, x.descricao) && String(y.parcela || '').includes('/') && y.parcela !== '1/1'); // parcela com número diferente (ex.: EBM 11/24 × 12/24)
  return g ? { mes, gasto: g } : null;
}

// Lançamento do cartão (seu) ligado a um gasto do mês
export function cartaoDoGasto(dados, mes, g) {
  const fatDe = (dt) => faturaDaCompra(dados, dt);
  return dados.cartao.find((c) => c.quem === dados.config.pessoaPadrao && fatDe(c.data) === mes.id && (acharNoMes(dados, c, fatDe) || {}).gasto === g) || null;
}

// Garante que um gasto de crédito do seu mês esteja no cartão (sem duplicar). Devolve o lançamento criado, ou null.
export function garantirNoCartao(dados, mes, g) {
  if (operacaoDe(dados, g.tipo) === 'Débito') return null;
  if (!g.valor) return null; // valor zero (ex.: pago em outro cartão) não vai para o cartão
  if (cartaoDoGasto(dados, mes, g)) return null;
  const data = g.data || periodoFatura(dados, mes).inicio; // sem data: primeiro dia da fatura
  const c = { id: Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join(''),
    data, quem: dados.config.pessoaPadrao, descricao: g.descricao, valor: g.valor, pgto: 0, parcelas: g.parcela || '1/1', tipo: g.tipo || '', oculto: !!g.oculto, assinatura: /^fixo$/i.test(g.parcela || '') ? true : null };
  dados.cartao.push(c);
  return c;
}

// Já existe no cartão compartilhado? (mesmo valor e mesma data, ou mesma fatura e nome parecido)
export function existeNoCartao(dados, x, quem, faturaDe) { return !!acharNoCartao(dados, x, faturaDe); }
// Procura no cartão de QUALQUER pessoa (a mesma compra pode já estar lá como de outra pessoa).
export function acharNoCartao(dados, x, faturaDe) {
  const fx = faturaDe(x.data);
  return dados.cartao.find((c) => {
    if (valorIgual(c.valor, x.valor) && c.data && c.data === x.data) return true;
    if (faturaDe(c.data) !== fx) return false;
    // mesmo nome e valor só é a mesma compra se for a mesma parcela, ou se uma das duas não tiver data;
    // compra à vista repetida em outro dia (ex.: Mercadinho R$ 3,19 dia 06 e dia 11) é outra compra
    const datasDiferentes = c.data && x.data && c.data !== x.data;
    if (valorIgual(c.valor, x.valor) && parecido(c.descricao, x.descricao) && (!datasDiferentes || mesmaParcela(c.parcelas, x.parcela))) return true;
    return valorPerto(c.valor, x.valor) && mesmaParcela(c.parcelas, x.parcela) && parecido(c.descricao, x.descricao);
  }) || null;
}
