// GERADO por scripts/montar-celular.js a partir de app/renderer/js — não edite aqui.
const MESES = { JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6, JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12 };
const NOMES = { janeiro: 1, fevereiro: 2, 'março': 3, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
const p2 = (n) => String(n).padStart(2, '0');


const RE_DATA = /^(\d{1,2})\s*(?:de\s+)?(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[A-ZÇ]*\.?\b/i;
const RE_DATA_NUM = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/;
const RE_VALOR = /^([-–−]?)\s*R\s?\$\s*([-–−]?)\s*(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})$/i;
const RE_FATURA = /\b(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+(?:de\s+)?(\d{4})\b/i;
const IGNORAR = /^(pagar|tudo|cart[õo]es|fatura|gr[áa]fico|pagamento m[íi]nimo|total|limite|vencimento|fechamento|ver mais)$/i;
// Telas que agrupam por dia ("Hoje", "Ontem", "Sexta, 12 de novembro") em vez de "11 NOV" em cada linha
const RE_RELATIVO = /^(hoje|ontem|anteontem)\b/i;
const RE_SEMANA = /^(?:seg|ter|qua|qui|sex|s[áa]b|dom)[a-zçá-]*\.?,?\s+/i;
// linha "22:30 · Pix" / "08:37 · Débito" / "19:01 · Saldo separado" (histórico da conta): diz o tipo do movimento
const RE_HORA_TIPO = /^\d{1,2}[:.h]\d{2}\s*[-–·•.+*]?\s*(.*)$/i;
const INTERNO = /saldo separado|dinheiro\s+(?:g|q)uardado|dinheiro\s+resgatado|^aplica[cç][aã]o\b|^resgate\b/i;
const ENTRADA = /\brecebid[oa]\b|^dep[óo]sito|^rendimento|^transfer[êe]ncia recebida/i;
const isoDia = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

function titulo(s) {
  // "IGREJA EVANGELICA MANANCIAIS" -> "Igreja Evangelica Mananciais" (só quando está tudo em maiúsculas)
  const minusculas = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E']);
  return s.replace(/\b([A-ZÀ-Ú]+)\b/g, (w, _a, pos) => {
    if (pos > 0 && minusculas.has(w)) return w.toLowerCase();
    if (w.length <= 2) return w; // iniciais: "F G D N"
    return w[0] + w.slice(1).toLowerCase();
  });
}

function limparDescricao(d) {
  let s = d.replace(/\s+/g, ' ').trim();
  s = s.replace(/^Pix no Cr[ée]dito\s*[-–]?\s*/i, 'Pix ');
  s = s.replace(/^Pg\s*\*\s*/i, '');
  // prefixo de maquininha ("Htm*", "Br1*"): o leitor às vezes troca o * por aspas
  s = s.replace(/^([A-Za-z0-9]{2,5})['"´`]\s?(?=[A-Za-zÀ-ú])/, '$1*');
  if (s === s.toUpperCase()) s = titulo(s);
  else s = s.replace(/(\b[A-ZÀ-Ú]{3,}\b(?:\s+\b[A-ZÀ-Ú]{2,}\b)+)/g, (m) => titulo(m));
  return s.trim();
}

function extrairParcela(desc) {
  let m = desc.match(/\s*[-–]?\s*parcela\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*$/i); // "- Parcela 2/2"
  if (!m) m = desc.match(/\s*[-–]?\s*\b(\d{1,2})\s*\/\s*(\d{1,2})\s*$/);
  if (!m) m = desc.match(/\s*[-–]?\s*parcela\s+(\d{1,2})\s+de\s+(\d{1,2})\s*$/i);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= Number(m[2])) return { desc: desc.slice(0, m.index).trim(), atual: Number(m[1]), total: Number(m[2]) };
  return { desc, atual: 1, total: 1 };
}

// Monta os lançamentos a partir das linhas lidas. Cada valor "R$ x,yy" é âncora de uma compra;
// a data e a descrição são as linhas mais próximas na mesma altura.
function montarLancamentos(ocr, anoReferencia, hoje = new Date()) {
  const linhas = (ocr.linhas || []).map((l) => ({ ...l, cy: l.y + l.h / 2, texto: String(l.texto || '').trim() })).filter((l) => l.texto);
  let faturaMes = null;
  for (const l of linhas) {
    const m = l.texto.match(RE_FATURA);
    if (m) { faturaMes = `${m[2]}-${p2(NOMES[m[1].toLowerCase().replace('ç', 'c')] || NOMES[m[1].toLowerCase()])}`; break; }
  }
  const datas = []; const valores = []; const textos = []; const tiposMov = [];
  for (const l of linhas) {
    const t = l.texto.replace(/\s+/g, ' ');
    const semSemana = t.replace(RE_SEMANA, '');
    let m;
    if ((m = t.match(RE_VALOR))) {
      const v = Number(m[3].replace(/\./g, '') + '.' + m[4]);
      valores.push({ ...l, valor: v, negativo: !!(m[1] || m[2]) });
    } else if ((m = t.match(RE_RELATIVO))) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - { hoje: 0, ontem: 1, anteontem: 2 }[m[1].toLowerCase()]);
      datas.push({ ...l, iso: isoDia(d), titulo: true });
    } else if ((m = semSemana.match(RE_DATA))) datas.push({ ...l, dia: Number(m[1]), mes: MESES[m[2].toUpperCase()], titulo: semSemana !== t || /\sde\s/i.test(t) });
    else if ((m = t.match(RE_HORA_TIPO))) { if (m[1] && /[A-Za-zÀ-ú]{3,}/.test(m[1])) tiposMov.push({ ...l, texto: m[1] }); }
    else if ((m = t.match(RE_DATA_NUM)) && Number(m[2]) >= 1 && Number(m[2]) <= 12) datas.push({ ...l, dia: Number(m[1]), mes: Number(m[2]), numerica: true });
    else if (!IGNORAR.test(t) && !RE_FATURA.test(t) && !/^\d{1,2}:\d{2}/.test(t)) textos.push(l);
  }
  // "2/2" no começo de uma linha da descrição (ex.: "Shein - Parcela" / "2/2") não é data:
  // só vale como data o que está na coluna das datas (alinhado às datas tipo "04 NOV").
  const comMes = datas.filter((d) => !d.numerica);
  if (comMes.length) {
    const colX = Math.max(...comMes.map((d) => d.x)) + 25;
    for (let i = datas.length - 1; i >= 0; i--) if (datas[i].numerica && datas[i].x > colX) textos.push(datas.splice(i, 1)[0]);
  }
  const vazio = { fatura_mes: faturaMes, lancamentos: [], cortados: [] };
  if (!valores.length && !datas.length) return vazio;
  const altura = Number(ocr.altura) || Math.max(...linhas.map((l) => l.y + l.h));
  const fat = faturaMes ? { ano: Number(faturaMes.slice(0, 4)), mes: Number(faturaMes.slice(5, 7)) } : { ano: anoReferencia, mes: 12 };
  const iso = (d) => (d ? d.iso || `${d.mes > fat.mes ? fat.ano - 1 : fat.ano}-${p2(d.mes)}-${p2(d.dia)}` : null);

  // Linhas cortadas na borda saem baixinhas ou encostadas na borda: não viram lançamento,
  // mas são guardadas como "pedaço cortado" para avisar se não aparecerem inteiras em outro print.
  const alturas = [...textos, ...valores, ...datas].map((l) => l.h).sort((a, b) => a - b);
  const hNormal = alturas[Math.floor(alturas.length / 2)] || 16;
  const naBorda = (l) => l.y <= 2 || l.y + l.h >= altura - 2;
  // linha baixinha só é "cortada" perto da borda de cima/baixo (no meio do print nada é cortado:
  // "Nova Pecas", sem letras com perna, sai mais baixa e é uma linha inteira)
  const pertoDaBorda = (l) => l.y < hNormal * 3 || l.y + l.h > altura - hNormal * 3;
  const ruim = (l) => naBorda(l) || (l.h < hNormal * 0.75 && pertoDaBorda(l));
  const pedacos = [];
  for (const lista of [textos, valores, datas]) for (let i = lista.length - 1; i >= 0; i--) if (ruim(lista[i])) pedacos.push(lista.splice(i, 1)[0]);

  valores.sort((a, b) => a.cy - b.cy);
  const passos = valores.slice(1).map((v, i) => v.cy - valores[i].cy).sort((a, b) => a - b);
  const passo = passos.length ? passos[Math.floor(passos.length / 2)] : hNormal * 3.5;
  const tolData = passo * 0.55;
  const colunaDatasFim = datas.length ? Math.max(...datas.map((d) => d.x + d.w)) : 0;
  const colunaValoresIni = valores.length ? Math.min(...valores.map((v) => v.x)) : Infinity;
  const primeiraData = datas.length ? Math.min(...datas.map((d) => d.y)) : 0;
  // lista que começa com um título de dia ("Hoje", "Ontem"): tudo acima dele é cabeçalho, nunca compra cortada
  const comecaComTitulo = datas.length && datas.find((d) => d.y === primeiraData).titulo;
  const naLista = (l) => !datas.length || l.y >= primeiraData - (comecaComTitulo ? hNormal * 0.5 : passo * 0.6);

  // Cada linha de descrição vai para o valor mais próximo na vertical.
  const grupos = valores.map(() => []);
  for (const t of textos) {
    if (t.x < colunaDatasFim - 4 && datas.length) continue;      // coluna das datas
    if (!naLista(t)) {                                           // cabeçalho...
      // ...ou o fim de uma compra cortada logo abaixo do cabeçalho (ex.: "Parcela 3/12" sozinho no topo)
      if (datas.length && !comecaComTitulo && t.y >= primeiraData - passo * 1.05 && /[A-Za-zÀ-ú]{3,}|\d+\/\d+/.test(t.texto)) pedacos.push(t);
      continue;
    }
    let melhor = -1; let dist = Infinity;
    valores.forEach((v, i) => { const dd = Math.abs(v.cy - t.cy); if (dd < dist) { dist = dd; melhor = i; } });
    if (melhor >= 0 && dist <= passo * 0.75 && t.x + t.w > valores[melhor].x + 4) continue; // é o próprio valor/texto colado nele
    if (t.x > colunaValoresIni + 4 && !(melhor >= 0 && dist <= passo * 0.75)) continue;      // texto solto na coluna dos valores
    if (melhor >= 0 && dist <= passo * 0.75) grupos[melhor].push(t);
    else pedacos.push(t); // descrição sem valor na mesma linha: compra cortada
  }

  // tipo do movimento ("Pix", "Débito", "Saldo separado") de cada valor (só no histórico da conta)
  const tipoDe = valores.map(() => '');
  for (const tm of tiposMov) {
    let melhor = -1; let dist = Infinity;
    valores.forEach((v, i) => { const dd = Math.abs(v.cy - (tm.y + tm.h / 2)); if (dd < dist) { dist = dd; melhor = i; } });
    if (melhor >= 0 && dist <= passo * 0.75) tipoDe[melhor] = tm.texto;
  }

  const lancamentos = [];
  const datasUsadas = new Set();
  let dataAnterior = null;
  valores.forEach((v, i) => {
    // data na mesma altura; se a fatura agrupa por dia (data como título), usa a última data acima
    let data = null; let melhor = Infinity;
    for (const d of datas) { const dd = Math.abs(d.cy - v.cy); if (dd < melhor) { melhor = dd; data = d; } }
    if (!data || melhor > tolData) {
      const acima = datas.filter((d) => d.cy < v.cy).sort((a, b) => b.cy - a.cy)[0];
      data = acima || dataAnterior;
    } else datasUsadas.add(data);
    if (!data) { if (naLista(v) && datas.length) pedacos.push(v); return; } // valor sem data
    dataAnterior = data;
    const partes = grupos[i].sort((a, b) => a.y - b.y || a.x - b.x).map((t) => t.texto);
    let desc = partes.join(' ').replace(/\s*-\s*/g, ' - ').replace(/\s+-\s+(\d{1,2}\/\d{1,2})$/, ' $1');
    const p = extrairParcela(desc);
    desc = limparDescricao(p.desc);
    if (!desc) { pedacos.push({ ...v, semDescricao: true, dataTxt: iso(data) }); return; } // valor legível, descrição não lida
    const mov = tipoDe[i];
    if (INTERNO.test(desc) || INTERNO.test(mov)) return; // dinheiro guardado/resgatado na própria conta: não é gasto
    const estorno = v.negativo || /estorno|cr[ée]dito de|reembolso/i.test(desc);
    const pagamento = /^pagamento\b|pagamento\s+(recebid|da fatura|de fatura|efetuad)|pagto\.?\s+(recebid|fatura)/i.test(desc);
    const entrada = !pagamento && (ENTRADA.test(desc) || ENTRADA.test(mov));
    lancamentos.push({
      data: iso(data), descricao: desc, valor: v.valor, y: v.cy,
      parcela_atual: p.atual, parcela_total: p.total, tipo: pagamento ? 'pagamento' : entrada ? 'entrada' : estorno ? 'estorno' : 'compra', categoria_sugerida: null,
      ...(mov && /d[ée]bito|pix|transfer|boleto|saque/i.test(mov) ? { debito: true, meio: mov } : {}),
    });
  });
  // Data na linha sem valor ao lado (quando cada linha tem sua data): compra com valor cortado.
  // (datas-título como "Hoje"/"Ontem" agrupam várias compras: não contam aqui)
  const porLinha = datas.filter((d) => !d.titulo);
  const dataPorLinha = porLinha.length && porLinha.length >= valores.length * 0.6;
  if (dataPorLinha) for (const d of porLinha) if (!datasUsadas.has(d) && naLista(d)) pedacos.push(d);

  // Agrupa os pedaços por altura e descreve cada compra cortada pela vizinha inteira.
  lancamentos.sort((a, b) => a.y - b.y);
  lancamentos.forEach((l, i) => { l.ordem = i; });
  const cortados = [];
  for (const pd of pedacos.filter((l) => !datas.length || l.y >= primeiraData - (comecaComTitulo ? 0 : passo * 1.05)).sort((a, b) => a.y - b.y)) {
    const cy = pd.y + pd.h / 2;
    let c = cortados.find((x) => Math.abs(x.cy - cy) < passo * 0.6);
    if (!c) { c = { cy, textos: [], data: null, valor: null, semDescricao: false }; cortados.push(c); }
    if (pd.semDescricao) { c.semDescricao = true; c.valor = pd.valor; c.data = c.data || pd.dataTxt; continue; }
    const m = pd.texto.match(RE_DATA);
    if (m) c.data = c.data || iso({ dia: Number(m[1]), mes: MESES[m[2].toUpperCase()] });
    else if (/[A-Za-zÀ-ú]{3,}/.test(pd.texto) && pd.h >= hNormal * 0.75) c.textos.push(pd.texto);
  }
  // ignora textos longe da lista (rodapé, menus do app do banco)
  const yIni = lancamentos.length ? lancamentos[0].y - passo * 1.3 : -Infinity;
  const yFim = lancamentos.length ? lancamentos.at(-1).y + passo * 1.3 : Infinity;
  const resultadoCortados = cortados.filter((c) => c.cy >= yIni && c.cy <= yFim).map((c) => {
    const antes = lancamentos.filter((l) => l.y < c.cy).at(-1);
    const depois = lancamentos.find((l) => l.y > c.cy);
    return {
      posicao: !antes ? 'inicio' : !depois ? 'fim' : 'meio',
      depoisDe: antes ? antes.ordem : null, antesDe: depois ? depois.ordem : null,
      semDescricao: c.semDescricao, valorVisto: c.valor,
      dataVista: c.data, textoVisto: limparDescricao(c.textos.join(' ')).slice(0, 60) || null,
    };
  });
  lancamentos.forEach((l) => delete l.y);
  return { fatura_mes: faturaMes, lancamentos, cortados: resultadoCortados };
}


export { montarLancamentos };
