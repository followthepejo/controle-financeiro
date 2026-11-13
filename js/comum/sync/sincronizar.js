// GERADO por scripts/montar-celular.js a partir de app/renderer/js — não edite aqui.
// Motor de sincronização PC <-> celular (o mesmo arquivo roda no app do PC e no app do celular).
//
// Os dados viram "registros" independentes (cada gasto, cada lançamento do cartão, cada mês, cada categoria...).
// Cada aparelho guarda, só para si, como estavam os registros na última sincronização ("estado").
// Ao sincronizar:
//   1. o que mudou neste aparelho desde a última vez ganha a hora de agora;
//   2. junta com o arquivo da nuvem registro por registro: vale a alteração mais recente;
//      apagar também é uma alteração (fica marcado por 180 dias para os outros aparelhos saberem).
// Assim, lançar no celular e no PC ao mesmo tempo não faz um apagar o outro.

const FORMATO = 'CFSYNC-DADOS';
const VERSAO = 1;
const GUARDAR_APAGADOS_DIAS = 180;

// Configurações que valem para todos os aparelhos (tema, fonte etc. ficam em cada um)
const CONFIG_COMUM = ['diaFechamento', 'pessoaPadrao', 'pessoas'];

function ordenarChaves(v) {
  if (Array.isArray(v)) return v.map(ordenarChaves);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, ordenarChaves(v[k])]));
  return v;
}
const texto = (v) => JSON.stringify(ordenarChaves(v));

// dados -> Map(chave -> texto JSON do registro), na ordem em que aparecem
export function decompor(dados) {
  const r = new Map();
  // configuração e cotação só entram se este aparelho tiver esses dados (um celular recém-instalado não apaga os do PC)
  const cfg = {}; for (const k of CONFIG_COMUM) if (dados.config && dados.config[k] !== undefined) cfg[k] = dados.config[k];
  if (Object.keys(cfg).length) r.set('config', texto(cfg));
  for (const c of dados.categorias || []) r.set(`cat:${c.nome}`, texto(c));
  for (const a of dados.assinaturas || []) r.set(`ass:${String(a.nome).toLowerCase()}`, texto(a));
  for (const [k, a] of Object.entries(dados.apelidos || {})) r.set(`ap:${k}`, texto(a));
  for (const m of dados.meses || []) {
    const { gastos, ...cab } = m;
    r.set(`mes:${m.id}`, texto(cab));
    for (const g of gastos || []) r.set(`g:${m.id}:${g.id}`, texto(g));
  }
  for (const x of dados.cartao || []) r.set(`c:${x.id}`, texto(x));
  const cr = dados.cripto || {};
  if (cr.cotacao !== undefined) r.set('cotacao', texto({ cotacao: cr.cotacao ?? null, cotacaoEm: cr.cotacaoEm ?? null }));
  for (const m of cr.meses || []) r.set(`cm:${m.id}`, texto(m));
  for (const [ano, a] of Object.entries(cr.anual || {})) r.set(`ca:${ano}`, texto(a));
  return r;
}

// Map de registros -> dados (mantendo as partes só deste aparelho: tema, chave da API...)
export function recompor(registros, dadosLocais) {
  const d = structuredClone(dadosLocais);
  d.categorias = []; d.assinaturas = []; d.apelidos = {}; d.meses = []; d.cartao = [];
  d.cripto = { ...(d.cripto || {}), meses: [], anual: {} };
  const meses = new Map();
  const gastosPorMes = new Map();
  for (const [k, v] of registros) {
    const o = JSON.parse(v);
    if (k === 'config') Object.assign(d.config, o);
    else if (k.startsWith('cat:')) d.categorias.push(o);
    else if (k.startsWith('ass:')) d.assinaturas.push(o);
    else if (k.startsWith('ap:')) d.apelidos[k.slice(3)] = o;
    else if (k.startsWith('mes:')) meses.set(o.id, o);
    else if (k.startsWith('g:')) { const mid = k.split(':')[1]; if (!gastosPorMes.has(mid)) gastosPorMes.set(mid, []); gastosPorMes.get(mid).push(o); }
    else if (k.startsWith('c:')) d.cartao.push(o);
    else if (k === 'cotacao') { d.cripto.cotacao = o.cotacao; d.cripto.cotacaoEm = o.cotacaoEm; }
    else if (k.startsWith('cm:')) d.cripto.meses.push(o);
    else if (k.startsWith('ca:')) d.cripto.anual[k.slice(3)] = o;
  }
  for (const [id, cab] of meses) d.meses.push({ ...cab, gastos: gastosPorMes.get(id) || [] });
  d.meses.sort((a, b) => a.id.localeCompare(b.id));
  d.cripto.meses.sort((a, b) => a.id.localeCompare(b.id));
  return d;
}

export const estadoVazio = () => ({ base: {}, ts: {}, apagados: {}, ultima: null });

// Marca com a hora atual o que mudou neste aparelho desde a última sincronização.
export function carimbar(dados, estado, agora = Date.now()) {
  const atual = decompor(dados);
  const est = { base: { ...estado.base }, ts: { ...estado.ts }, apagados: { ...estado.apagados }, ultima: estado.ultima };
  for (const [k, v] of atual) {
    if (est.base[k] !== v) { est.ts[k] = agora; est.base[k] = v; delete est.apagados[k]; }
  }
  for (const k of Object.keys(est.base)) {
    if (!atual.has(k)) { est.apagados[k] = agora; delete est.base[k]; delete est.ts[k]; }
  }
  return { atual, estado: est };
}

// Junta este aparelho com o documento da nuvem. Devolve os dados juntos, o novo estado e o novo documento.
export function mesclar(dados, estado, remoto, agora = Date.now()) {
  const { atual, estado: est } = carimbar(dados, estado, agora);
  const regRemoto = remoto && remoto.registros ? remoto.registros : {};
  const apRemoto = remoto && remoto.apagados ? remoto.apagados : {};
  const final = new Map();
  const tsFinal = {};
  const apagados = {};
  const limite = agora - GUARDAR_APAGADOS_DIAS * 86400000;
  let daNuvem = 0; let paraNuvem = 0;

  const chaves = [...atual.keys(), ...Object.keys(regRemoto).filter((k) => !atual.has(k))];
  for (const k of new Set([...chaves, ...Object.keys(est.apagados), ...Object.keys(apRemoto)])) {
    const cand = [];
    if (atual.has(k)) cand.push({ t: est.ts[k] || 0, v: atual.get(k), de: 'local' });
    if (regRemoto[k]) cand.push({ t: regRemoto[k].t || 0, v: regRemoto[k].v, de: 'nuvem' });
    if (est.apagados[k]) cand.push({ t: est.apagados[k], apagado: true, de: 'local' });
    if (apRemoto[k]) cand.push({ t: apRemoto[k], apagado: true, de: 'nuvem' });
    // o mais recente vence; empate: apagado vence (evita "ressuscitar"), depois a versão da nuvem
    cand.sort((a, b) => b.t - a.t || (b.apagado ? 1 : 0) - (a.apagado ? 1 : 0) || (a.de === 'nuvem' ? -1 : 1));
    const v = cand[0];
    if (!v) continue;
    if (v.apagado) { if (v.t >= limite) apagados[k] = v.t; if (atual.has(k)) daNuvem += v.de === 'nuvem' ? 1 : 0; continue; }
    final.set(k, v.v); tsFinal[k] = v.t;
    if (v.de === 'nuvem' && atual.get(k) !== v.v) daNuvem++;
    if (v.de === 'local' && (!regRemoto[k] || regRemoto[k].v !== v.v)) paraNuvem++;
  }
  // mantém a ordem: primeiro como está aqui, depois o que veio da nuvem
  const ordenado = new Map([...atual.keys()].filter((k) => final.has(k)).map((k) => [k, final.get(k)]));
  for (const [k, v] of final) if (!ordenado.has(k)) ordenado.set(k, v);

  const novoDoc = { formato: FORMATO, versao: VERSAO, atualizadoEm: agora, registros: {}, apagados };
  for (const [k, v] of ordenado) novoDoc.registros[k] = { v, t: tsFinal[k] };
  const novoEstado = { base: Object.fromEntries(ordenado), ts: tsFinal, apagados: {}, ultima: agora };
  return { dados: recompor(ordenado, dados), estado: novoEstado, documento: novoDoc, resumo: { daNuvem, paraNuvem } };
}

export { FORMATO, VERSAO };

// A tela (PC) editou a partir de uma versão antiga dos dados enquanto a sincronização trouxe novidades:
// aplica só o que a tela mudou (em relação à versão que ela tinha) por cima dos dados atuais.
export function aplicarDiferenca(baseTela, dadosTela, dadosAtuais) {
  const novos = decompor(dadosTela);
  const atuais = decompor(dadosAtuais);
  for (const [k, v] of novos) if (baseTela.get(k) !== v) atuais.set(k, v);
  for (const k of baseTela.keys()) if (!novos.has(k)) atuais.delete(k);
  return recompor(atuais, { ...dadosTela, segredos: dadosAtuais.segredos });
}
