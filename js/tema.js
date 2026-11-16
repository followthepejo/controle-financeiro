// Tema do celular: os MESMOS temas do PC (cores, fonte, tamanho do texto, modo limpo, importar/exportar).
// Por padrão segue o tema escolhido no PC; dá para escolher um só para o celular (fica guardado no aparelho).
import { html, montar, avisar } from './comum/util.js';
import { TEMAS, CAMPOS } from './comum/temas.js';
import { I } from './ui.js';

export const FONTES = [
  { id: 'Sistema (iPhone)', css: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif" },
  { id: 'Inter', css: "'Inter', -apple-system, sans-serif" },
  { id: 'Poppins', css: "'Poppins', -apple-system, sans-serif" },
  { id: 'Nunito', css: "'Nunito', -apple-system, sans-serif" },
  { id: 'Roboto', css: "'Roboto', -apple-system, sans-serif" },
  { id: 'JetBrains Mono', css: "'JetBrains Mono', ui-monospace, Menlo, monospace" },
  { id: 'Georgia (serifada)', css: "Georgia, 'Times New Roman', serif" },
];
const CHAVE = 'cf-aparencia';
const PADRAO = { seguirPC: true, tema: 'roxo', temaPersonalizado: null, fonte: 'Sistema (iPhone)', tamanhoFonte: 16, limpo: false, animTeclado: 'pulso' };
export const ANIMACOES = [['pulso', 'Pulso (a tecla afunda com um anel)'], ['onda', 'Onda (círculo sai do dedo)'], ['brilho', 'Brilho (a tecla acende)']];

export function lerAparencia() { try { return { ...PADRAO, ...JSON.parse(localStorage.getItem(CHAVE) || '{}') }; } catch { return { ...PADRAO }; } }
function gravarAparencia(a) { try { localStorage.setItem(CHAVE, JSON.stringify(a)); } catch { /* sem espaço: segue sem guardar */ } }

const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lum = (h) => { const [r, g, b] = hexRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const misturar = (a, b, t) => { const x = hexRgb(a); const y = hexRgb(b); return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`; };

export function paletaDe(cfg) {
  if (cfg.tema === 'personalizado' && cfg.temaPersonalizado) return { ...TEMAS.roxo, ...cfg.temaPersonalizado, nome: 'Personalizado' };
  return TEMAS[cfg.tema] || TEMAS.roxo;
}
// O que vale agora: o tema do PC (se "seguir o PC") ou o do celular
export function aparenciaEfetiva(configPC) {
  const a = lerAparencia();
  if (a.seguirPC && configPC && configPC.tema) {
    const fontePC = FONTES.find((f) => f.id === configPC.fonte) ? configPC.fonte : a.fonte;
    return { ...a, tema: configPC.tema, temaPersonalizado: configPC.temaPersonalizado, fonte: fontePC, limpo: !!configPC.limpo };
  }
  return a;
}

export function aplicarTema(cfg) {
  const p = paletaDe(cfg);
  const raiz = document.documentElement;
  const v = (k, x) => raiz.style.setProperty(k, x);
  const claro = lum(p.fundo) > 0.4;
  v('--fundo', p.fundo); v('--painel', p.superficie); v('--painel2', p.superficie2); v('--borda', p.borda);
  v('--texto', p.texto); v('--sutil', p.textoSec); v('--acento', p.destaque); v('--pos', p.positivo); v('--neg', p.negativo); v('--aviso', p.aviso);
  v('--acento2', claro ? misturar(p.destaque, '#000000', 0.15) : misturar(p.destaque, '#ffffff', 0.25)); // destaque legível como texto
  const [r, g, b] = hexRgb(p.destaque);
  v('--acento-fundo', `rgba(${r},${g},${b},0.16)`);
  v('--sobre-acento', lum(p.destaque) > 0.45 ? '#0b0b0b' : '#ffffff');
  v('--fonte', (FONTES.find((f) => f.id === cfg.fonte) || FONTES[0]).css);
  v('--tam', `${Math.min(19, Math.max(14, Number(cfg.tamanhoFonte) || 16))}px`);
  raiz.style.colorScheme = claro ? 'light' : 'dark';
  raiz.dataset.modo = claro ? 'claro' : 'escuro';
  raiz.dataset.animTeclado = cfg.animTeclado || lerAparencia().animTeclado || 'pulso';
  document.body?.classList.toggle('limpo', !!cfg.limpo);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', p.fundo);
}

// ---------- Janela de tema (em Ajustes) ----------
export function abrirTema(configPC, aoMudar) {
  const rasc = lerAparencia();
  rasc.temaPersonalizado = { ...(rasc.temaPersonalizado || TEMAS.roxo) };
  delete rasc.temaPersonalizado.nome;
  if (rasc.seguirPC && configPC && configPC.tema) Object.assign(rasc, { tema: configPC.tema, fonte: FONTES.some((f) => f.id === configPC.fonte) ? configPC.fonte : rasc.fonte, limpo: !!configPC.limpo, ...(configPC.temaPersonalizado ? { temaPersonalizado: { ...configPC.temaPersonalizado } } : {}) });
  const fundo = document.createElement('div');
  fundo.className = 'modal-fundo';
  document.body.append(fundo);
  // as cores das miniaturas são aplicadas depois (a página não aceita style="" no HTML, por segurança)
  const pintar = () => fundo.querySelectorAll('[data-pinta]').forEach((el) => { for (const par of el.dataset.pinta.split(';')) { const [k, val] = par.split('='); el.style[k] = val; } });
  const mini = (p) => html`<span class="tema-mini" data-pinta="background=${p.superficie};borderColor=${p.borda}">
    <span class="tm-bola" data-pinta="background=${p.destaque}"></span>
    <span class="tm-linhas"><i data-pinta="background=${p.texto};width=64%"></i><i data-pinta="background=${p.textoSec};width=30%"></i><i data-pinta="background=${p.positivo};width=18%"></i><i data-pinta="background=${p.negativo};width=18%"></i></span></span>`;
  function desenhar() {
    const pers = { ...TEMAS.roxo, ...rasc.temaPersonalizado };
    montar(fundo, html`<div class="modal tema-modal" role="dialog" aria-modal="true" aria-label="Tema">
      <div class="cartao-topo"><h3>Tema</h3><button class="icone-btn" data-acao="fechar" aria-label="Fechar">✕</button></div>
      <label class="linha-check"><input type="checkbox" data-acao="seguir" ${rasc.seguirPC ? 'checked' : ''}> Usar o mesmo tema do PC</label>
      <div class="temas-grade ${rasc.seguirPC ? 'apagado' : ''}">
        ${Object.entries(TEMAS).map(([id, p]) => html`<button class="tema-cartao ${rasc.tema === id ? 'ativo' : ''}" data-tema="${id}" data-pinta="background=${p.fundo}">${mini(p)}<span class="tema-nome" data-pinta="color=${p.texto}">${p.nome}</span></button>`)}
        <button class="tema-cartao ${rasc.tema === 'personalizado' ? 'ativo' : ''}" data-tema="personalizado" data-pinta="background=${pers.fundo}">${mini(pers)}<span class="tema-nome" data-pinta="color=${pers.texto}">Personalizado</span></button>
      </div>
      ${rasc.tema === 'personalizado' && !rasc.seguirPC ? html`<div class="cores-grade">${CAMPOS.map(([k, rot]) => html`<label class="cor-campo"><input type="color" data-cor="${k}" value="${pers[k]}"><span>${rot}</span></label>`)}</div>` : ''}
      <label class="linha-check"><input type="checkbox" data-acao="limpo" ${rasc.limpo ? 'checked' : ''} ${rasc.seguirPC ? 'disabled' : ''}> Modo limpo (sem bordas e enfeites)</label>
      <label>Fonte<select data-acao="fonte" ${rasc.seguirPC ? 'disabled' : ''}>${FONTES.map((f) => html`<option value="${f.id}" ${f.id === rasc.fonte ? 'selected' : ''}>${f.id}</option>`)}</select></label>
      <label>Animação do teclado do PIN<select data-acao="anim">${ANIMACOES.map(([id, rot]) => html`<option value="${id}" ${id === rasc.animTeclado ? 'selected' : ''}>${rot}</option>`)}</select></label>
      <label>Tamanho do texto: <b id="tam-txt">${rasc.tamanhoFonte}px</b><input type="range" min="14" max="19" step="1" data-acao="tamanho" value="${rasc.tamanhoFonte}"></label>
      <div class="duas"><label class="btn">Importar<input type="file" id="tema-arq" accept=".json,application/json" hidden></label><button class="btn" data-acao="exportar">Exportar</button></div>
      <div class="acoes"><button class="btn" data-acao="fechar">Cancelar</button><button class="btn primario" data-acao="concluir">${I.check} Concluir</button></div>
    </div>`);
    pintar();
  }
  const previa = () => aplicarTema(rasc);
  const fechar = (salvar) => {
    fundo.remove();
    if (salvar) { gravarAparencia({ seguirPC: rasc.seguirPC, tema: rasc.tema, temaPersonalizado: rasc.tema === 'personalizado' ? rasc.temaPersonalizado : lerAparencia().temaPersonalizado, fonte: rasc.fonte, tamanhoFonte: rasc.tamanhoFonte, limpo: rasc.limpo, animTeclado: rasc.animTeclado }); avisar('Tema salvo neste celular.'); }
    aoMudar();
  };
  fundo.addEventListener('click', (e) => {
    if (e.target === fundo) return fechar(false);
    const t = e.target.closest('[data-tema],[data-acao]');
    if (!t || t.matches('input')) return;
    if (t.dataset.tema) { if (rasc.seguirPC) rasc.seguirPC = false; rasc.tema = t.dataset.tema; desenhar(); previa(); return; }
    const a = t.dataset.acao;
    if (a === 'fechar') fechar(false);
    if (a === 'concluir') fechar(true);
    if (a === 'exportar') {
      const p = paletaDe(rasc);
      const blob = new Blob([JSON.stringify({ app: 'Controle Financeiro', ...p, fonte: rasc.fonte, limpo: rasc.limpo, tamanhoFonte: rasc.tamanhoFonte }, null, 2)], { type: 'application/json' });
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `tema-${(p.nome || 'meu').toLowerCase().replace(/\W+/g, '-')}.json`;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    }
  });
  fundo.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.cor) { rasc.temaPersonalizado[t.dataset.cor] = t.value; previa(); }
    if (t.dataset.acao === 'tamanho') { rasc.tamanhoFonte = Number(t.value); fundo.querySelector('#tam-txt').textContent = `${t.value}px`; previa(); }
  });
  fundo.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.dataset.acao === 'seguir') { rasc.seguirPC = t.checked; if (t.checked && configPC) Object.assign(rasc, { tema: configPC.tema || 'roxo', limpo: !!configPC.limpo, ...(FONTES.some((f) => f.id === configPC.fonte) ? { fonte: configPC.fonte } : {}) }); desenhar(); previa(); }
    if (t.dataset.acao === 'limpo') { rasc.limpo = t.checked; previa(); }
    if (t.dataset.acao === 'fonte') { rasc.fonte = t.value; previa(); }
    if (t.dataset.acao === 'anim') { rasc.animTeclado = t.value; previa(); }
    if (t.dataset.cor) desenhar();
    if (t.id === 'tema-arq' && t.files[0]) {
      try {
        const t2 = JSON.parse(await t.files[0].text());
        const novo = {};
        for (const [k] of CAMPOS) if (typeof t2[k] === 'string' && /^#[0-9a-fA-F]{6}$/.test(t2[k])) novo[k] = t2[k];
        if (Object.keys(novo).length < 5) throw new Error('Arquivo de tema sem cores válidas.');
        Object.assign(rasc, { seguirPC: false, tema: 'personalizado', temaPersonalizado: { ...rasc.temaPersonalizado, ...novo } });
        if (FONTES.some((f) => f.id === t2.fonte)) rasc.fonte = t2.fonte;
        if (typeof t2.limpo === 'boolean') rasc.limpo = t2.limpo;
        desenhar(); previa(); avisar('Tema importado. Toque em Concluir para manter.');
      } catch (er) { avisar(er.message || 'Arquivo de tema inválido.', 'erro'); }
    }
  });
  desenhar();
}
