// Peças de tela do celular: ícones, teclado do PIN, seletor de mês.
import { html, cru, nomeMes } from './comum/util.js';

const svg = (d) => cru(`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`);
export const I = {
  inicio: svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  mais: svg('<path d="M12 5v14M5 12h14"/>'),
  cartao: svg('<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6 15h4"/>'),
  foto: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M21 16l-5-5-9 8"/>'),
  engrenagem: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  calendario: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  esq: svg('<path d="M15 5l-7 7 7 7"/>'),
  dir: svg('<path d="M9 5l7 7-7 7"/>'),
  apagar: svg('<path d="M9 6h11v12H9l-6-6z"/><path d="M13 10l4 4M17 10l-4 4"/>'),
  sync: svg('<path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>'),
  cadeado: svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  check: svg('<path d="M5 12l5 5 9-10"/>'),
  alerta: svg('<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>'),
  nuvem: svg('<path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z"/>'),
  lixo: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
};

// Teclado do PIN (6 números). aoCompletar(pin) é chamado ao digitar o 6º número.
export function tecladoPin(alvo, aoCompletar) {
  let pin = '';
  const pontos = () => alvo.querySelectorAll('.pin-pontos i').forEach((p, i) => p.classList.toggle('cheio', i < pin.length));
  alvo.insertAdjacentHTML('beforeend', String(html`<div class="pin-pontos" aria-hidden="true">${[0, 1, 2, 3, 4, 5].map(() => html`<i></i>`)}</div>
    <div class="teclado">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => html`<button type="button" data-n="${n}">${n}</button>`)}<span></span><button type="button" data-n="0">0</button><button type="button" data-n="x" aria-label="Apagar">${I.apagar}</button></div>`));
  let ocupado = false;
  alvo.querySelector('.teclado').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-n]');
    if (!b || ocupado) return;
    if (b.dataset.n === 'x') pin = pin.slice(0, -1);
    else if (pin.length < 6) pin += b.dataset.n;
    navigator.vibrate?.(8);
    pontos();
    if (pin.length === 6) {
      ocupado = true;
      const p = pin;
      try { await aoCompletar(p); } finally { ocupado = false; pin = ''; pontos(); }
    }
  });
  return { limpar: () => { pin = ''; pontos(); } };
}

export function seletorMes(ids, atual) {
  const i = ids.indexOf(atual);
  return html`<div class="seletor-mes">
    <button class="icone-btn" data-mes="${ids[i - 1] || ''}" ${i <= 0 ? 'disabled' : ''} aria-label="Mês anterior">${I.esq}</button>
    <b>${atual ? nomeMes(atual) : '—'}</b>
    <button class="icone-btn" data-mes="${ids[i + 1] || ''}" ${i < 0 || i >= ids.length - 1 ? 'disabled' : ''} aria-label="Próximo mês">${I.dir}</button></div>`;
}

// A largura é aplicada depois (aplicarLarguras): a política de segurança da página não aceita style="" no HTML.
export const barra = (fracao, perigo) => html`<div class="barra"><i data-w="${Math.max(0, Math.min(100, (fracao || 0) * 100)).toFixed(1)}" class="${perigo ? 'perigo' : ''}"></i></div>`;
export function aplicarLarguras(raiz) { raiz.querySelectorAll('[data-w]').forEach((el) => { el.style.width = `${el.dataset.w}%`; }); }
