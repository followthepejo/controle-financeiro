// GERADO por scripts/montar-celular.js a partir de app/renderer/js — não edite aqui.
// Temas, cores, fontes e modo limpo.
import { html, montar, $, $$, avisar, chamar } from './util.js';

export const TEMAS = {
  roxo: { nome: 'Roxo (padrão)', fundo: '#0f0f14', superficie: '#17171f', superficie2: '#1f1f2a', borda: '#2c2c3a', texto: '#f2f2f7', textoSec: '#9a9ab0', destaque: '#8b5cf6', positivo: '#22c55e', negativo: '#f43f5e', aviso: '#f59e0b' },
  escuro: { nome: 'Escuro', fundo: '#0b0d0c', superficie: '#131715', superficie2: '#1a201d', borda: '#26302b', texto: '#eef3f0', textoSec: '#8fa198', destaque: '#4ade80', positivo: '#4ade80', negativo: '#f87171', aviso: '#fbbf24' },
  claro: { nome: 'Claro', fundo: '#f5f6f8', superficie: '#ffffff', superficie2: '#f0f1f4', borda: '#e2e4ea', texto: '#15161a', textoSec: '#62666f', destaque: '#16a34a', positivo: '#16a34a', negativo: '#dc2626', aviso: '#d97706' },
  rosa: { nome: 'Rosa', fundo: '#fff7fa', superficie: '#ffffff', superficie2: '#fdeef4', borda: '#f6d5e2', texto: '#2a1520', textoSec: '#8a5a70', destaque: '#e0457b', positivo: '#0f9d7a', negativo: '#d93a5f', aviso: '#d9822b' },
  azul: { nome: 'Azul', fundo: '#0a0e1a', superficie: '#111729', superficie2: '#182036', borda: '#243050', texto: '#eef2ff', textoSec: '#8d99bd', destaque: '#4f7cff', positivo: '#34d399', negativo: '#fb7185', aviso: '#fbbf24' },
  violeta: { nome: 'Violeta', fundo: '#120f1c', superficie: '#1a1628', superficie2: '#231d36', borda: '#342a4f', texto: '#f3efff', textoSec: '#a399c4', destaque: '#7c6cf0', positivo: '#3ddc97', negativo: '#ff6b8b', aviso: '#ffc857' },
  floresta: { nome: 'Floresta', fundo: '#0c120f', superficie: '#121b16', superficie2: '#18241d', borda: '#24352b', texto: '#ecf5ef', textoSec: '#8aa596', destaque: '#3fae6a', positivo: '#3fae6a', negativo: '#ef6f6c', aviso: '#e8b04b' },
  turquesa: { nome: 'Turquesa', fundo: '#071214', superficie: '#0d1c1f', superficie2: '#12262a', borda: '#1d3a3f', texto: '#e8fbfc', textoSec: '#86aeb3', destaque: '#2dd4bf', positivo: '#2dd4bf', negativo: '#fb7185', aviso: '#fbbf24' },
};

export const FONTES = [
  { id: 'Inter', css: "'Inter', 'Segoe UI', sans-serif" },
  { id: 'Poppins', css: "'Poppins', 'Segoe UI', sans-serif" },
  { id: 'Nunito', css: "'Nunito', 'Segoe UI', sans-serif" },
  { id: 'Roboto', css: "'Roboto', 'Segoe UI', sans-serif" },
  { id: 'JetBrains Mono', css: "'JetBrains Mono', Consolas, monospace" },
  { id: 'Segoe UI (sistema)', css: "'Segoe UI', system-ui, sans-serif" },
  { id: 'Georgia (serifada)', css: "Georgia, 'Times New Roman', serif" },
];

const CAMPOS = [
  ['fundo', 'Fundo'], ['superficie', 'Cartões'], ['superficie2', 'Cartões (2º nível)'], ['borda', 'Bordas'],
  ['texto', 'Texto'], ['textoSec', 'Texto secundário'], ['destaque', 'Destaque'], ['positivo', 'Positivo'], ['negativo', 'Negativo'], ['aviso', 'Alerta'],
];

function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function luminancia(h) { const [r, g, b] = hexRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }

export function paleta(cfg) {
  if (cfg.tema === 'personalizado' && cfg.temaPersonalizado) return { ...TEMAS.roxo, ...cfg.temaPersonalizado, nome: 'Personalizado' };
  return TEMAS[cfg.tema] || TEMAS.roxo;
}

export function aplicarAparencia(cfg) {
  const p = paleta(cfg);
  const raiz = document.documentElement;
  const v = (k, x) => raiz.style.setProperty(k, x);
  v('--fundo', p.fundo); v('--sup', p.superficie); v('--sup2', p.superficie2); v('--borda', p.borda);
  v('--texto', p.texto); v('--texto2', p.textoSec); v('--destaque', p.destaque); v('--pos', p.positivo); v('--neg', p.negativo); v('--aviso', p.aviso);
  const [r, g, b] = hexRgb(p.destaque);
  v('--destaque-suave', `rgba(${r},${g},${b},0.14)`);
  v('--destaque-borda', `rgba(${r},${g},${b},0.45)`);
  v('--sobre-destaque', luminancia(p.destaque) > 0.45 ? '#0b0b0b' : '#ffffff');
  const fonte = FONTES.find((f) => f.id === cfg.fonte) || FONTES[0];
  v('--fonte', fonte.css);
  v('--tam', `${cfg.tamanhoFonte || 14}px`);
  raiz.dataset.modo = luminancia(p.fundo) > 0.4 ? 'claro' : 'escuro';
  document.body.classList.toggle('limpo', !!cfg.limpo);
  // Botões de minimizar/maximizar/fechar com a cor do cabeçalho (no modo limpo o cabeçalho usa o fundo).
  window.cf.corJanela(cfg.limpo ? p.fundo : p.superficie, p.textoSec).catch(() => {});
  window.dispatchEvent(new CustomEvent('tema-alterado'));
}

export const cor = (nome) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim();

// ---------- Modal de tema ----------
export function abrirModalTema(estado, aoSalvar) {
  const cfg = estado.dados.config;
  const original = { tema: cfg.tema, temaPersonalizado: cfg.temaPersonalizado, fonte: cfg.fonte, tamanhoFonte: cfg.tamanhoFonte, limpo: cfg.limpo };
  const rasc = { ...original, temaPersonalizado: { ...(cfg.temaPersonalizado || TEMAS.roxo) } };
  delete rasc.temaPersonalizado.nome;

  const fundo = document.createElement('div');
  fundo.className = 'modal-fundo';
  document.body.append(fundo);

  const miniatura = (p) => html`<span class="tema-mini" style="background:${p.superficie};border-color:${p.borda}">
      <span class="tm-bola" style="background:${p.destaque}"></span>
      <span class="tm-linhas"><i style="background:${p.texto};width:64%"></i><i style="background:${p.textoSec};width:30%"></i><i style="background:${p.textoSec};width:22%"></i>
      <br><i style="background:${p.positivo};width:18%"></i><i style="background:${p.negativo};width:18%"></i><i style="background:${p.destaque};width:18%"></i><i style="background:${p.aviso};width:18%"></i></span></span>`;

  function desenhar() {
    const pers = { ...TEMAS.roxo, ...rasc.temaPersonalizado };
    montar(fundo, html`<div class="modal tema-modal" role="dialog" aria-modal="true" aria-label="Tema">
      <div class="modal-topo"><h3>Tema</h3><button class="icone-btn" data-acao="fechar" aria-label="Fechar">✕</button></div>
      <div class="temas-grade">
        ${Object.entries(TEMAS).map(([id, p]) => html`<button class="tema-cartao ${rasc.tema === id ? 'ativo' : ''}" data-tema="${id}" style="background:${p.fundo}">
          ${miniatura(p)}<span class="tema-nome" style="color:${p.texto}">${p.nome}</span></button>`)}
        <button class="tema-cartao ${rasc.tema === 'personalizado' ? 'ativo' : ''}" data-tema="personalizado" style="background:${pers.fundo}">
          ${miniatura(pers)}<span class="tema-nome" style="color:${pers.texto}"><span class="arco-iris"></span> Personalizado</span></button>
      </div>
      ${rasc.tema === 'personalizado' ? html`<div class="cores-grade">${CAMPOS.map(([k, rot]) => html`
        <label class="cor-campo"><input type="color" data-cor="${k}" value="${pers[k]}"><span>${rot}</span></label>`)}</div>` : ''}
      <div class="linha-opcao">
        <span>Modo limpo <span class="dica" title="Esconde bordas, sombras e detalhes secundários para uma tela mais limpa e focada nos números.">?</span></span>
        <label class="chave"><input type="checkbox" data-acao="limpo" ${rasc.limpo ? 'checked' : ''}><span></span></label>
      </div>
      <div class="linha-opcao"><span>Fonte</span>
        <select data-acao="fonte">${FONTES.map((f) => html`<option value="${f.id}" ${f.id === rasc.fonte ? 'selected' : ''}>${f.id}</option>`)}</select></div>
      <div class="linha-opcao"><span>Tamanho do texto</span>
        <span class="faixa"><input type="range" min="12" max="18" step="1" data-acao="tamanho" value="${rasc.tamanhoFonte}"><b>${rasc.tamanhoFonte}px</b></span></div>
      <div class="modal-rodape">
        <button class="btn" data-acao="importar">Importar</button>
        <button class="btn" data-acao="exportar">Exportar</button>
        <span class="espaco"></span>
        <button class="btn primario" data-acao="concluir">Concluir</button>
      </div></div>`);
  }
  const previa = () => aplicarAparencia(rasc);
  function fechar(salvar) {
    fundo.remove();
    if (salvar) { Object.assign(cfg, rasc, { temaPersonalizado: rasc.tema === 'personalizado' || cfg.temaPersonalizado ? rasc.temaPersonalizado : null }); aoSalvar(); }
    aplicarAparencia(cfg);
  }

  fundo.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-tema],[data-acao]');
    if (e.target === fundo) return fechar(false);
    if (!t) return;
    if (t.dataset.tema) { rasc.tema = t.dataset.tema; desenhar(); previa(); return; }
    const a = t.dataset.acao;
    if (a === 'fechar') fechar(false);
    if (a === 'concluir') fechar(true);
    if (a === 'exportar') {
      try { const n = await chamar(window.cf.exportarTema({ app: 'Controle Financeiro', ...paleta(rasc), fonte: rasc.fonte, limpo: rasc.limpo, tamanhoFonte: rasc.tamanhoFonte })); if (n) avisar(`Tema exportado: ${n}`); } catch (er) { avisar(er.message, 'erro'); }
    }
    if (a === 'importar') {
      try {
        const t2 = await chamar(window.cf.importarTema());
        if (!t2) return;
        const novo = {};
        for (const [k] of CAMPOS) if (typeof t2[k] === 'string' && /^#[0-9a-fA-F]{6}$/.test(t2[k])) novo[k] = t2[k];
        if (Object.keys(novo).length < 5) throw new Error('Arquivo de tema sem cores válidas.');
        rasc.tema = 'personalizado'; rasc.temaPersonalizado = { ...rasc.temaPersonalizado, ...novo };
        if (FONTES.some((f) => f.id === t2.fonte)) rasc.fonte = t2.fonte;
        if (typeof t2.limpo === 'boolean') rasc.limpo = t2.limpo;
        desenhar(); previa(); avisar('Tema importado. Clique em Concluir para manter.');
      } catch (er) { avisar(er.message, 'erro'); }
    }
  });
  fundo.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.cor) { rasc.temaPersonalizado[t.dataset.cor] = t.value; previa(); }
    if (t.dataset.acao === 'tamanho') { rasc.tamanhoFonte = Number(t.value); t.nextElementSibling.textContent = `${t.value}px`; previa(); }
  });
  fundo.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.acao === 'limpo') { rasc.limpo = t.checked; previa(); }
    if (t.dataset.acao === 'fonte') { rasc.fonte = t.value; previa(); }
    if (t.dataset.cor) desenhar();
  });
  fundo.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(false); });
  desenhar();
  $('.tema-cartao.ativo', fundo)?.focus();
}

export { CAMPOS, $$ };
