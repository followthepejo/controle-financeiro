// GERADO por scripts/montar-celular.js a partir de app/renderer/js — não edite aqui.
// Utilidades da tela. Todo texto vindo de dados passa por esc() — nada de HTML cru de usuário.

const MAPA = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"'`]/g, (c) => MAPA[c]);

class Cru { constructor(s) { this.s = s; } toString() { return this.s; } }
export const cru = (s) => new Cru(String(s));

// Template seguro: html`<p>${valor}</p>` escapa valores; arrays são juntados; cru() passa direto.
export function html(partes, ...vals) {
  let out = partes[0];
  vals.forEach((v, i) => { out += render(v) + partes[i + 1]; });
  return cru(out);
}
function render(v) {
  if (v instanceof Cru) return v.s;
  if (Array.isArray(v)) return v.map(render).join('');
  if (v === false || v == null) return '';
  return esc(v);
}

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
export function montar(el, conteudo) { el.innerHTML = String(conteudo); }

const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtUSD = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' });
const fmtNum = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const fmtPct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
export const brl = (v) => fmtBRL.format(Number(v) || 0);
export const usd = (v) => fmtUSD.format(Number(v) || 0);
export const numero = (v) => fmtNum.format(Number(v) || 0);
export const pct = (v) => fmtPct.format(Number.isFinite(v) ? v : 0);

export const MESES_NOME = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MESES_AB = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
export const nomeMes = (id) => `${MESES_NOME[Number(id.slice(5, 7)) - 1]} ${id.slice(0, 4)}`;
export const rotuloMes = (id) => `${MESES_AB[Number(id.slice(5, 7)) - 1]}.${id.slice(2, 4)}`;
export const dataBR = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
export const dataCurta = (iso) => (iso ? `${iso.slice(8, 10)} ${MESES_AB[Number(iso.slice(5, 7)) - 1].toLowerCase()}` : '—');
export function somarMes(id, n) {
  const a = Number(id.slice(0, 4)); const m = Number(id.slice(5, 7)) - 1 + n;
  const d = new Date(Date.UTC(a, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
export function hojeISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export const novoId = () => [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('');
export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Converte "1.234,56" / "1234.56" / "R$ 12,3" para número.
export function lerValor(txt) {
  if (typeof txt === 'number') return txt;
  let s = String(txt || '').replace(/[R$\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

let toastTimer;
export function avisar(msg, tipo = 'info') {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = msg;
  t.className = `toast ${tipo} visivel`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('visivel'), tipo === 'erro' ? 6000 : 3200);
}

export function confirmar(titulo, texto, rotuloOk = 'Confirmar', perigo = false) {
  return new Promise((resolve) => {
    const fundo = document.createElement('div');
    fundo.className = 'modal-fundo';
    montar(fundo, html`<div class="modal pequeno" role="dialog" aria-modal="true" aria-label="${titulo}">
      <h3>${titulo}</h3><p class="sutil">${texto}</p>
      <div class="acoes"><button class="btn" data-r="0">Cancelar</button><button class="btn ${perigo ? 'perigo' : 'primario'}" data-r="1">${rotuloOk}</button></div></div>`);
    fundo.addEventListener('click', (e) => {
      const r = e.target.closest('[data-r]');
      if (r || e.target === fundo) { fundo.remove(); resolve(r ? r.dataset.r === '1' : false); }
    });
    document.body.append(fundo);
    $('[data-r="1"]', fundo).focus();
  });
}

// Lê o resultado {ok, valor, erro} do processo principal.
export async function chamar(promessa) {
  const r = await promessa;
  if (!r || !r.ok) throw new Error((r && r.erro) || 'Erro desconhecido.');
  return r.valor;
}

// Aviso em janela (com lista), só com botão "Entendi".
export function alertar(titulo, texto, itens = []) {
  return new Promise((resolve) => {
    const fundo = document.createElement('div');
    fundo.className = 'modal-fundo';
    montar(fundo, html`<div class="modal" role="alertdialog" aria-modal="true" aria-label="${titulo}">
      <h3>${titulo}</h3><p class="sutil">${texto}</p>
      ${itens.length ? html`<ul class="lista-aviso">${itens.map((i) => html`<li>${i}</li>`)}</ul>` : ''}
      <div class="acoes"><button class="btn primario" data-ok>Entendi</button></div></div>`);
    fundo.addEventListener('click', (e) => { if (e.target.closest('[data-ok]')) { fundo.remove(); resolve(); } });
    document.body.append(fundo);
    fundo.querySelector('[data-ok]').focus();
  });
}
