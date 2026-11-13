// Converte o resultado do Tesseract no mesmo formato do leitor do Windows ({ largura, altura, linhas: [{texto,x,y,w,h}] }),
// para usar a MESMA montagem dos lançamentos do PC. O Tesseract junta numa linha só textos da mesma altura
// (data, loja e valor); aqui a linha é quebrada onde há um espaço grande entre as palavras (colunas).
export function linhasDoTesseract(data, largura, altura) {
  const linhas = [];
  for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) {
    const palavras = (l.words || []).filter((w) => w.text && w.text.trim() && w.confidence > 20).sort((a, b) => a.bbox.x0 - b.bbox.x0);
    if (!palavras.length) continue;
    const alturas = palavras.map((w) => w.bbox.y1 - w.bbox.y0).sort((a, b) => a - b);
    const hMed = alturas[Math.floor(alturas.length / 2)] || 12;
    let seg = null;
    const fechar = () => { if (seg) linhas.push({ texto: seg.t.join(' '), x: seg.x0, y: seg.y0, w: seg.x1 - seg.x0, h: seg.y1 - seg.y0 }); };
    for (const w of palavras) {
      const bx = w.bbox;
      if (seg && bx.x0 - seg.x1 <= hMed * 1.3) { seg.t.push(w.text.trim()); seg.x1 = Math.max(seg.x1, bx.x1); seg.y0 = Math.min(seg.y0, bx.y0); seg.y1 = Math.max(seg.y1, bx.y1); continue; }
      fechar();
      seg = { t: [w.text.trim()], x0: bx.x0, y0: bx.y0, x1: bx.x1, y1: bx.y1 };
    }
    fechar();
  }
  // "R$" às vezes sai separado do número por um espaço maior: junta de volta
  for (let i = linhas.length - 1; i > 0; i--) {
    const a = linhas[i - 1]; const b = linhas[i];
    if (/^[-–−]?R\$?$/i.test(a.texto) && Math.abs(a.y - b.y) < a.h && b.x - (a.x + a.w) < a.h * 3 && /^[-–−]?\d/.test(b.texto)) {
      linhas.splice(i - 1, 2, { texto: `${a.texto.replace(/\$?$/, '$')} ${b.texto}`, x: a.x, y: Math.min(a.y, b.y), w: b.x + b.w - a.x, h: Math.max(a.h, b.h) });
    }
  }
  const saida = [];
  for (const l of linhas) {
    const t = corrigirTexto(l.texto);
    // data grudada na descrição ("11 NOV Wizmart"): separa, como no leitor do Windows
    const m = t.match(new RegExp(`^(\\d{1,2} (?:${MESES}))\\s+(.+)$`, 'i'));
    if (m) {
      const fr = m[1].length / t.length;
      saida.push({ ...l, texto: m[1], w: l.w * fr });
      saida.push({ ...l, texto: m[2], x: l.x + l.w * (fr + 0.02), w: l.w * (1 - fr - 0.02) });
    } else saida.push({ ...l, texto: t });
  }
  return { largura, altura, linhas: saida };
}

const MESES = 'JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ';
// Vícios típicos do Tesseract em prints de banco
export function corrigirTexto(texto) {
  let t = texto.trim().replace(/^[“”"'‘’`]+/, '');
  // valor: a vírgula some ou vira outro sinal ("R$ 19115", "R$ 57/19", "R$ 3.19") — no banco sempre há centavos
  const v = t.match(/^([-–−]?)\s*R\s?\$\s*([-–−]?)\s*([\d.,/;:'\s]+)$/i);
  if (v) {
    const dig = v[3].replace(/\D/g, '');
    if (dig.length >= 3) t = `${v[1]}R$ ${v[2]}${dig.slice(0, -2)},${dig.slice(-2)}`;
  }
  // data: "1INOV", "1O0 NOV", "11NOV" -> "11 NOV" / "10 NOV"
  const d = t.match(new RegExp(`^([\\dIlO|]{1,3})\\s*(${MESES})[A-Z!.]*(\\s+.*)?$`, 'i'));
  if (d) {
    let dia = d[1];
    if (dia.length > 2) dia = [...dia].filter((c, i) => /\d/.test(c) || i === 0).join('').slice(0, 2);
    dia = dia.replace(/[Il|]/g, '1').replace(/O/g, '0');
    if (/^\d{1,2}$/.test(dia) && Number(dia) >= 1 && Number(dia) <= 31) t = `${dia} ${d[2].toUpperCase()}${d[3] || ''}`;
  }
  return t;
}
