// Leitura do print NO PRÓPRIO CELULAR (Tesseract em português). A imagem não sai do aparelho.
import { linhasDoTesseract, corrigirTexto } from './ocr-linhas.js';
import { montarLancamentos } from './comum/montar-print.js';

const BASE = './vendor/tesseract/';
let trabalhador = null;
let aoProgresso = null;

async function obter() {
  if (trabalhador) return trabalhador;
  if (!window.Tesseract) {
    await new Promise((ok, erro) => { const s = document.createElement('script'); s.src = BASE + 'tesseract.min.js'; s.onload = ok; s.onerror = () => erro(new Error('Não consegui carregar o leitor de texto. Confira a internet e tente de novo.')); document.head.append(s); });
  }
  trabalhador = await window.Tesseract.createWorker('por', 1, {
    workerPath: BASE + 'worker.min.js', corePath: BASE, langPath: BASE, gzip: true, workerBlobURL: false,
    logger: (m) => { if (aoProgresso && m.status === 'recognizing text') aoProgresso(m.progress); },
  });
  await trabalhador.setParameters({ preserve_interword_spaces: '1', tessedit_pageseg_mode: '11' }); // 11 = texto espalhado (colunas do app do banco)
  return trabalhador;
}

// Prepara a imagem: tons de cinza, fundo claro (prints em modo escuro são invertidos) e ampliada se for pequena
async function preparar(arquivo) {
  const bmp = await createImageBitmap(arquivo);
  const esc = bmp.width < 1100 ? 2 : Math.min(1, 2200 / bmp.width); // mesmo ajuste testado no PC
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * esc); c.height = Math.round(bmp.height * esc);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  const img = g.getImageData(0, 0, c.width, c.height);
  const px = img.data;
  let soma = 0;
  for (let i = 0; i < px.length; i += 4) { const y = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; px[i] = px[i + 1] = px[i + 2] = y; soma += y; }
  if (soma / (px.length / 4) < 128) for (let i = 0; i < px.length; i += 4) px[i] = px[i + 1] = px[i + 2] = 255 - px[i];
  g.putImageData(img, 0, 0);
  return { canvas: c, largura: c.width, altura: c.height };
}

// 2ª leitura só dos valores ("R$ 3,19"): recorte ampliado, aceitando apenas números, vírgula e R$.
// Na leitura geral a vírgula às vezes some ou vira "1" (R$ 3,19 -> R$ 31,19); assim fica confiável.
async function relerValores(w, canvas, linhas) {
  const alvos = linhas.filter((l) => /^[-–−]?\s*R\s?\$/.test(l.texto));
  if (!alvos.length) return;
  await w.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: 'R$0123456789,.-' });
  try {
    for (const l of alvos) {
      const pad = Math.round(l.h * 0.35);
      const x = Math.max(0, l.x - pad); const y = Math.max(0, l.y - pad);
      const cw = Math.min(canvas.width - x, l.w + pad * 2); const ch = Math.min(canvas.height - y, l.h + pad * 2);
      const esc = Math.max(1, 64 / l.h);
      const c = document.createElement('canvas');
      c.width = Math.round(cw * esc); c.height = Math.round(ch * esc);
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(canvas, x, y, cw, ch, 0, 0, c.width, c.height);
      const { data } = await w.recognize(c);
      const t = corrigirTexto(String(data.text || '').replace(/\s+/g, ' ').trim());
      if (/^[-–−]?R\$ [-–−]?\d+,\d{2}$/.test(t)) l.texto = t;
    }
  } finally { await w.setParameters({ tessedit_pageseg_mode: '11', tessedit_char_whitelist: '' }); }
}

export async function lerPrintCelular(arquivo, anoReferencia, progresso) {
  const w = await obter();
  const { canvas, largura, altura } = await preparar(arquivo);
  aoProgresso = progresso;
  try {
    const { data } = await w.recognize(canvas, {}, { blocks: true, text: false });
    const ocr = linhasDoTesseract(data, largura, altura);
    await relerValores(w, canvas, ocr.linhas);
    return montarLancamentos(ocr, anoReferencia);
  } finally { aoProgresso = null; }
}
