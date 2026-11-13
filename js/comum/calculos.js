// GERADO por scripts/montar-celular.js a partir de app/renderer/js — não edite aqui.
// Regras de negócio (as mesmas da planilha), sem mexer na tela.
import { somarMes, novoId, norm } from './util.js';

export function operacaoDe(dados, tipo) {
  const c = dados.categorias.find((k) => k.nome === tipo);
  if (c) return c.operacao;
  return /[a-zà-ú]D$/.test(tipo || '') ? 'Débito' : 'Crédito';
}

export function resumoMes(dados, mes) {
  const r = mes.receitas;
  const descontos = r.descontos.reduce((s, d) => s + d.valor, 0);
  const liquido = r.salarioBruto - descontos;
  const outras = (r.outras || []).reduce((s, x) => s + x.valor, 0);
  const salarioTotal = liquido + r.alimentacao + r.valeCombustivel + outras;
  const ganho = salarioTotal + r.extra;
  let credito = 0; let debito = 0; let assinaturas = 0; let parcelados = 0; let avista = 0;
  const porCat = new Map();
  for (const g of mes.gastos) {
    if (g.oculto) continue; // oculto não pesa
    const op = operacaoDe(dados, g.tipo);
    if (op === 'Débito') debito += g.valor; else credito += g.valor;
    const k = g.tipo || 'Sem categoria';
    porCat.set(k, (porCat.get(k) || 0) + g.valor);
    const p = (g.parcela || '').trim();
    if (/^fixo$/i.test(p)) assinaturas += g.valor;
    else if (p === '1/1' || !p) avista += g.valor;
    else parcelados += g.valor;
  }
  const gasto = credito + debito;
  const categorias = [...porCat.entries()].map(([nome, valor]) => ({ nome, valor, operacao: operacaoDe(dados, nome) })).sort((a, b) => b.valor - a.valor);
  return {
    liquido, descontos, outras, salarioTotal, ganho, credito, debito, gasto, saldo: ganho - gasto,
    tetoCredito: mes.tetos.credito, tetoDebito: mes.tetos.debito,
    usoCredito: mes.tetos.credito ? credito / mes.tetos.credito : 0,
    usoDebito: mes.tetos.debito ? debito / mes.tetos.debito : 0,
    assinaturas, parcelados, avista, proximoMes: assinaturas + parcelados, categorias,
  };
}

export function diasRestantes(mes) {
  if (!mes.proximaRef) return null;
  const alvo = new Date(mes.proximaRef + 'T00:00:00');
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return Math.round((alvo - hoje) / 86400000);
}

export function lerParcela(txt) {
  const m = String(txt || '').replace(/\s/g, '').match(/^(\d{1,4})\/(\d{1,4})$/);
  return m ? { atual: Number(m[1]), total: Number(m[2]) } : null;
}

// Mesma lógica da macro "Criar próximo mês".
export function criarProximoMes(origem) {
  const id = somarMes(origem.id, 1);
  const erros = [];
  const gastos = [];
  for (const g of origem.gastos) {
    const p = (g.parcela || '').trim();
    if (/^fixo$/i.test(p)) { gastos.push({ ...g, id: novoId(), data: '', origem: 'automatico' }); continue; }
    const pp = lerParcela(p);
    if (!pp) { if (p) erros.push(`"${g.descricao}": parcela "${p}" inválida`); continue; }
    if (pp.atual > pp.total) { erros.push(`"${g.descricao}": parcela ${p} maior que o total`); continue; }
    if (pp.atual < pp.total) gastos.push({ ...g, id: novoId(), parcela: `${pp.atual + 1}/${pp.total}`, data: '', origem: 'automatico' });
  }
  let proximaRef = '';
  if (origem.proximaRef) {
    const d = new Date(origem.proximaRef + 'T00:00:00');
    d.setMonth(d.getMonth() + 1);
    proximaRef = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return {
    erros,
    mes: {
      id, proximaRef, tetos: { ...origem.tetos },
      receitas: { ...origem.receitas, extra: 0, descontos: origem.receitas.descontos.map((x) => ({ ...x })), outras: (origem.receitas.outras || []).map((x) => ({ ...x })) },
      gastos,
    },
  };
}

// Aprende "descrição → categoria" com o histórico (para sugerir no print e no lançamento rápido).
export function mapaAprendido(dados) {
  const contagem = new Map();
  for (const m of dados.meses) for (const g of m.gastos) {
    if (!g.tipo || !g.descricao) continue;
    const k = chaveDescricao(g.descricao);
    if (!k) continue;
    const c = contagem.get(k) || new Map();
    c.set(g.tipo, (c.get(g.tipo) || 0) + 1);
    contagem.set(k, c);
  }
  const mapa = new Map();
  for (const [k, c] of contagem) mapa.set(k, [...c.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  return mapa;
}
export const chaveDescricao = (d) => norm(d).replace(/\d+\/\d+/g, '').replace(/[^a-z ]/g, '').split(' ').filter((w) => w.length > 2).slice(0, 3).join(' ');

export function sugerirCategoria(dados, mapa, descricao) {
  const k = chaveDescricao(descricao);
  if (mapa.has(k)) return mapa.get(k);
  const primeira = k.split(' ')[0];
  if (primeira) for (const [kk, v] of mapa) if (kk.split(' ')[0] === primeira) return v;
  const n = norm(descricao);
  const regras = [[/posto|shell|ipiranga|petrobras|combust/, 'CombustívelC'], [/uber|99 ?app|taxi/, 'TransporteC'], [/mercado|supermerc|atacad|assai|carrefour/, 'Mercado'],
    [/ifood|burger|mcdonald|lanche|padaria|cafe|coffee|sorvet|pizza/, 'LancheC'], [/farmac|drogar|venancio|raia|pacheco/, 'Médics'], [/igreja|ebm/, 'Curso Igreja']];
  for (const [re, cat] of regras) if (re.test(n) && dados.categorias.some((c) => c.nome === cat)) return cat;
  return '';
}

export function resumoCripto(mesCripto, cotacaoPadrao) {
  const cot = mesCripto.cotacao || cotacaoPadrao || 0;
  const dias = mesCripto.dias.filter((d) => d.pnl != null);
  const total = dias.reduce((s, d) => s + d.pnl, 0);
  const ganhos = dias.filter((d) => d.pnl > 0).reduce((s, d) => s + d.pnl, 0);
  const perdas = dias.filter((d) => d.pnl < 0).reduce((s, d) => s + d.pnl, 0);
  const meta = mesCripto.dias.reduce((s, d) => s + (d.meta || 0), 0);
  return { cot, total, totalBRL: total * cot, ganhos, perdas, diasGanhando: dias.filter((d) => d.pnl > 0).length, diasPerdendo: dias.filter((d) => d.pnl < 0).length, meta };
}

export function diasNoMes(id) { return new Date(Number(id.slice(0, 4)), Number(id.slice(5, 7)), 0).getDate(); }

// ---------- Ciclo da fatura ----------
// O mês do app é o mês da FATURA. O cartão fecha no dia "diaFechamento" (padrão 4):
// a fatura de Dezembro reúne as compras de 04/11 até 03/12 e fecha em 04/12.
// Compra feita no próprio dia do fechamento já entra na fatura seguinte.
const p2 = (n) => String(n).padStart(2, '0');
export const diaFech = (dados) => dados.config.diaFechamento || 4;
export const fechamentoDe = (dados, mesId) => `${mesId}-${p2(diaFech(dados))}`;
export function periodoFatura(dados, mes) {
  const fim = mes.proximaRef || fechamentoDe(dados, mes.id);           // data de fechamento (exclusiva)
  const inicio = `${somarMes(fim.slice(0, 7), -1)}-${fim.slice(8, 10)}`; // fechamento anterior (inclusivo)
  const ultimo = new Date(fim + 'T00:00:00'); ultimo.setDate(ultimo.getDate() - 1);
  return { inicio, fim, ultimoDia: `${ultimo.getFullYear()}-${p2(ultimo.getMonth() + 1)}-${p2(ultimo.getDate())}` };
}
export function faturaDaCompra(dados, dataISO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataISO || '')) return null;
  const mesCompra = dataISO.slice(0, 7);
  return Number(dataISO.slice(8, 10)) >= diaFech(dados) ? somarMes(mesCompra, 1) : mesCompra;
}
