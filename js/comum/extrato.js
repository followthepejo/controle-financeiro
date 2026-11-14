// GERADO por scripts/montar-celular.js a partir de app/renderer/js — não edite aqui.
// Lê arquivos exportados pelo banco (Nubank): CSV e OFX, da fatura do cartão ou do extrato da conta.
// Devolve o mesmo formato da leitura de print ({ fatura_mes, lancamentos, cortados }), para usar a MESMA conferência.
// (limpeza de nomes e parcelas: mesma regra de app/ocr.js)

const p2 = (n) => String(n).padStart(2, '0');
const INTERNO = /saldo separado|dinheiro\s+(?:g|q)uardado|dinheiro\s+resgatado|^aplica[cç][aã]o\b|^resgate\b|\brdb\b|caixinha/i;
const PAGAMENTO = /^pagamento\b|pagamento\s+(recebid|da fatura|de fatura|efetuad)|pagto\.?\s+(recebid|fatura)/i;

function titulo(s) {
  const minusculas = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E']);
  return s.replace(/\b([A-ZÀ-Ú]+)\b/g, (w, _a, pos) => {
    if (pos > 0 && minusculas.has(w)) return w.toLowerCase();
    if (w.length <= 2) return w;
    return w[0] + w.slice(1).toLowerCase();
  });
}
export function limparDescricao(d) {
  let s = String(d || '').replace(/\s+/g, ' ').trim();
  s = s.replace(/^Pix no Cr[ée]dito\s*[-–]?\s*/i, 'Pix ');
  s = s.replace(/^Pg\s*\*\s*/i, '');
  if (s === s.toUpperCase()) s = titulo(s);
  else s = s.replace(/(\b[A-ZÀ-Ú]{3,}\b(?:\s+\b[A-ZÀ-Ú]{2,}\b)+)/g, (m) => titulo(m));
  return s.trim();
}
export function extrairParcela(desc) {
  let m = desc.match(/\s*[-–]?\s*parcela\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*$/i);
  if (!m) m = desc.match(/\s*[-–]?\s*\b(\d{1,2})\s*\/\s*(\d{1,2})\s*$/);
  if (!m) m = desc.match(/\s*[-–]?\s*parcela\s+(\d{1,2})\s+de\s+(\d{1,2})\s*$/i);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= Number(m[2])) return { desc: desc.slice(0, m.index).trim(), atual: Number(m[1]), total: Number(m[2]) };
  return { desc, atual: 1, total: 1 };
}

// bytes -> texto (o OFX do banco costuma vir em Windows-1252)
export function decodificar(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const utf = new TextDecoder('utf-8').decode(u8);
  return utf.includes('�') ? new TextDecoder('windows-1252').decode(u8) : utf.replace(/^﻿/, '');
}

const numero = (s) => {
  let t = String(s).replace(/[R$\s]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};
const dataIso = (s) => {
  let m = String(s).match(/^(\d{4})-?(\d{2})-?(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[3]}-${p2(m[2])}-${p2(m[1])}`;
  return '';
};

// Um movimento -> lançamento. conta=true: extrato da CONTA (saída = débito/Pix; entrada é ignorada)
function lancamento(data, memo, valorAssinado, conta, ordem) {
  const bruto = String(memo || '').trim();
  if (!data || !bruto || !Number.isFinite(valorAssinado) || valorAssinado === 0) return null;
  if (INTERNO.test(bruto)) return null; // dinheiro guardado/resgatado na própria conta
  const pixNoCredito = /pix\s+no\s+cr[ée]dito/i.test(bruto);
  const p = extrairParcela(bruto.replace(/\s*-\s*/g, ' - '));
  const descricao = limparDescricao(p.desc) || bruto;
  const base = { data, descricao, valor: Math.abs(valorAssinado), parcela_atual: p.atual, parcela_total: p.total, categoria_sugerida: null, ordem };
  if (conta) {
    if (valorAssinado > 0) return { ...base, tipo: 'entrada' }; // dinheiro que entrou: não é gasto
    const meio = /pix/i.test(bruto) && !pixNoCredito ? 'Pix' : /boleto/i.test(bruto) ? 'Boleto' : /transfer/i.test(bruto) ? 'Transferência' : 'Débito';
    return { ...base, tipo: 'compra', debito: true, meio };
  }
  // cartão: compra é positiva no CSV (negativa no OFX, já invertida antes de chegar aqui)
  if (valorAssinado < 0) return { ...base, tipo: PAGAMENTO.test(bruto) ? 'pagamento' : 'estorno' };
  return { ...base, tipo: 'compra' };
}

// ---------- CSV ----------
function linhasCsv(texto) {
  const linhas = []; let campo = ''; let linha = []; let aspas = false;
  const sep = (texto.split(/\r?\n/)[0].match(/;/g) || []).length > (texto.split(/\r?\n/)[0].match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) { if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++; } else if (ch === '"') aspas = false; else campo += ch; continue; }
    if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && texto[i + 1] === '\n') i++; linha.push(campo); if (linha.some((x) => x.trim())) linhas.push(linha); linha = []; campo = ''; }
    else campo += ch;
  }
  linha.push(campo); if (linha.some((x) => x.trim())) linhas.push(linha);
  return linhas;
}

export function lerCsv(texto, nomeArquivo = '') {
  const linhas = linhasCsv(texto);
  if (linhas.length < 2) throw new Error('O arquivo CSV está vazio.');
  const cab = linhas[0].map((c) => c.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
  const col = (...nomes) => cab.findIndex((c) => nomes.includes(c));
  const iData = col('date', 'data'); const iValor = col('amount', 'valor'); const iDesc = col('title', 'descricao', 'description', 'historico');
  if (iData < 0 || iValor < 0 || iDesc < 0) throw new Error('Não reconheci esse CSV. Use o arquivo exportado pelo app do banco (colunas data, descrição e valor).');
  const conta = cab.includes('identificador') || cab[iValor] === 'valor'; // CSV da conta Nubank: Data,Valor,Identificador,Descrição
  const lancamentos = [];
  linhas.slice(1).forEach((l, k) => {
    const v = numero(l[iValor]);
    const x = lancamento(dataIso(l[iData].trim()), l[iDesc], v, conta, k);
    if (x) lancamentos.push(x);
  });
  // Nubank_AAAA-MM-DD.csv: a data é o vencimento -> mês da fatura
  const m = String(nomeArquivo).match(/(\d{4})-(\d{2})-\d{2}/);
  return { fatura_mes: !conta && m ? `${m[1]}-${m[2]}` : null, lancamentos, cortados: [], fonte: conta ? 'extrato da conta (CSV)' : 'fatura do cartão (CSV)' };
}

// ---------- OFX ----------
export function lerOfx(texto) {
  const tag = (bloco, nome) => { const m = bloco.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, 'i')); return m ? m[1].trim() : ''; };
  const cartao = /<CREDITCARDMSGSRSV1>|<CCSTMTRS>/i.test(texto);
  const conta = !cartao && /<BANKMSGSRSV1>|<STMTRS>/i.test(texto);
  if (!cartao && !conta) throw new Error('Não reconheci esse OFX. Use o arquivo exportado pelo app do banco.');
  const blocos = texto.split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/STMTTRN>/i)[0]);
  const lancamentos = [];
  blocos.forEach((b, k) => {
    const v = numero(tag(b, 'TRNAMT'));
    const memo = tag(b, 'MEMO') || tag(b, 'NAME');
    // no OFX do cartão a compra vem negativa: inverte para o padrão "compra positiva"
    const x = lancamento(dataIso(tag(b, 'DTPOSTED')), memo, cartao ? -v : v, conta, k);
    if (x) lancamentos.push(x);
  });
  let fatura = null;
  if (cartao) { const fim = dataIso(tag(texto, 'DTEND')); if (fim) fatura = fim.slice(0, 7); }
  return { fatura_mes: fatura, lancamentos, cortados: [], fonte: cartao ? 'fatura do cartão (OFX)' : 'extrato da conta (OFX)' };
}

export const ehExtrato = (nome) => /\.(csv|ofx)$/i.test(String(nome || ''));
export function lerExtrato(nome, bytes) {
  const texto = decodificar(bytes);
  if (/\.ofx$/i.test(nome) || /<OFX>/i.test(texto)) return lerOfx(texto);
  return lerCsv(texto, nome);
}
