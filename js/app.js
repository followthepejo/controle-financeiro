// App do celular: abre com o PIN, guarda tudo criptografado no aparelho e sincroniza com o PC pelo seu GitHub privado.
import { html, montar, $, avisar, confirmar, hojeISO } from './comum/util.js';
import { RepoGitHub } from './comum/sync/github.js';
import { sincronizarComRepo } from './comum/sync/orquestrar.js';
import { decompor, aplicarDiferenca } from './comum/sync/sincronizar.js';
import { faturaDaCompra } from './comum/calculos.js';
import { importarChave } from './comum/sync/cripto.js';
import * as cofre from './cofre-local.js';
import { aplicarTema, aparenciaEfetiva } from './tema.js';
import { I, tecladoPin, aplicarLarguras } from './ui.js';
import * as inicio from './telas/inicio.js';
import * as lancar from './telas/lancar.js';
import * as cartao from './telas/cartao.js';
import * as print from './telas/print.js';
import * as ajustes from './telas/ajustes.js';
import * as gastos from './telas/gastos.js';
import * as mes from './telas/mes.js';

const raiz = $('#raiz');
const TELAS = { inicio, mes, lancar, cartao, print, ajustes, gastos };
const ABAS = [['inicio', 'Painel', I.inicio], ['mes', 'Mês', I.calendario], ['lancar', 'Lançar', I.mais], ['cartao', 'Cartão', I.cartao], ['print', 'Print', I.foto]];
const BLOQUEAR_APOS = 5 * 60 * 1000; // fora do app por mais de 5 min: pede o PIN de novo

const est = { lig: null, chave: null, dados: null, sinc: null, cache: {}, tela: 'inicio', mesId: null, sincronizando: false, ultima: null, erro: null, versao: 0 };
window.__cf = est; // (só para testes)

// ---------- dados ----------
function normalizar(d) {
  d.config = d.config || {};
  const c = d.config;
  if (!Array.isArray(c.pessoas) || !c.pessoas.length) c.pessoas = [c.pessoaPadrao || 'Eu'];
  if (!c.pessoaPadrao) c.pessoaPadrao = c.pessoas[0];
  if (!c.diaFechamento) c.diaFechamento = 4;
  for (const k of ['categorias', 'meses', 'cartao', 'assinaturas']) if (!Array.isArray(d[k])) d[k] = [];
  for (const k of ['cripto', 'apelidos', 'segredos']) if (!d[k] || typeof d[k] !== 'object') d[k] = {};
  d.meses.sort((a, b) => a.id.localeCompare(b.id));
  return d;
}
// Celular novo começa REALMENTE vazio (sem pessoas/config padrão), para não mandar nada por cima do que veio do PC
const vazio = () => ({ config: {}, segredos: {}, categorias: [], meses: [], cartao: [], cripto: {}, apelidos: {}, assinaturas: [] });
const repo = () => new RepoGitHub({ dono: est.lig.dono, repo: est.lig.repo, token: est.lig.token });
async function persistir() { await cofre.salvarDados(est.chave, est.lig.sal, { dados: est.dados, estado: est.sinc, cache: est.cache }); }

let timerSync = null;
async function salvar() {
  est.versao++;
  try { await persistir(); } catch (e) { avisar('Não consegui guardar no celular: ' + e.message, 'erro'); }
  clearTimeout(timerSync); timerSync = setTimeout(() => sincronizar(), 1500);
}

let rodando = null; let denovo = false;
function sincronizar() {
  if (!est.chave) return Promise.resolve();
  if (rodando) { denovo = true; return rodando; }
  rodando = (async () => {
    if (!navigator.onLine) { est.erro = 'Sem internet. O que você lançar fica guardado aqui e vai para o PC quando a internet voltar.'; desenharStatus(); return; }
    est.sincronizando = true; desenharStatus();
    const base = decompor(est.dados); const v0 = est.versao;
    try {
      const r = await sincronizarComRepo({ repo: repo(), chave: est.chave, sal: est.lig.sal, dados: structuredClone(est.dados), estado: est.sinc, cache: est.cache });
      if (!est.chave) return; // bloqueou no meio
      if (est.versao !== v0) { est.dados = aplicarDiferenca(base, est.dados, r.dados); denovo = true; } // você lançou algo durante a sincronização
      else est.dados = r.dados;
      normalizar(est.dados);
      est.sinc = r.estado; est.cache = r.cache; est.ultima = Date.now(); est.erro = null;
      await persistir();
      if (r.resumo.daNuvem > 0) { aplicarTema(aparenciaEfetiva(est.dados.config)); redesenharSeguro(); }
    } catch (e) { est.erro = e.message; } finally { est.sincronizando = false; desenharStatus(); }
  })().finally(() => { rodando = null; if (denovo) { denovo = false; sincronizar(); } });
  return rodando;
}

// ---------- telas de entrada ----------
function telaPin(msg = '') {
  est.chave = null; est.dados = null; est.lig = null;
  montar(raiz, html`<main class="entrada">
    <img src="icones/icone-192.png" alt="" width="76" height="76" class="entrada-logo">
    <h1>Controle Financeiro</h1>
    <p class="sutil" id="pin-msg">${msg || 'Digite seu PIN'}</p>
    <div id="pin"></div>
    <p class="erro" id="pin-erro" role="alert"></p>
  </main>`);
  tecladoPin($('#pin'), async (pin) => {
    $('#pin-erro').textContent = ''; $('#pin-msg').textContent = 'Abrindo…';
    try {
      const { lig, chave } = await cofre.abrirComPin(pin);
      const pacote = await cofre.lerDados(chave);
      est.lig = lig; est.chave = chave;
      est.dados = pacote ? normalizar(pacote.dados) : vazio(); est.sinc = pacote ? pacote.estado : null; est.cache = (pacote && pacote.cache) || {};
      abrirApp();
      sincronizar();
    } catch (e) {
      if (!(await cofre.temLigacao())) return telaParear(e.message);
      $('#pin-erro').textContent = e.message; $('#pin-msg').textContent = 'Digite seu PIN';
    }
  });
}

function telaParear(msg = '') {
  montar(raiz, html`<main class="entrada parear">
    <img src="icones/icone-192.png" alt="" width="76" height="76" class="entrada-logo">
    <h1>Ligar ao seu PC</h1>
    <ol class="passos">
      <li>No PC, abra <b>Configurações → Celular e sincronização</b>, digite seu PIN e toque em <b>Gerar código para o celular</b>.</li>
      <li>Copie o código, cole aqui e toque em <b>Continuar</b>.</li>
      <li>Digite o <b>mesmo PIN</b> do PC.</li>
    </ol>
    <textarea id="codigo" rows="4" placeholder="CF2.…" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>
    <div class="linha-botoes"><button class="btn" id="colar">Colar</button><button class="btn primario" id="continuar">Continuar</button></div>
    <p class="erro" role="alert">${msg}</p>
    <p class="sutil pequeno">O código traz a ligação com o seu GitHub, protegida pelo seu PIN. Depois de usar, apague o código de onde você colou (ex.: Telegram).</p>
  </main>`);
  $('#colar').onclick = async () => { try { $('#codigo').value = (await navigator.clipboard.readText()).trim(); } catch { avisar('Não consegui colar. Toque e segure no quadro → Colar.', 'erro'); } };
  $('#continuar').onclick = () => {
    const codigo = $('#codigo').value.trim();
    if (!codigo) return avisar('Cole o código do PC primeiro.', 'erro');
    montar(raiz, html`<main class="entrada"><img src="icones/icone-192.png" alt="" width="76" height="76" class="entrada-logo">
      <h1>Digite o PIN do PC</h1><p class="sutil" id="pin-msg">O mesmo PIN que abre o app no computador.</p><div id="pin"></div><p class="erro" id="pin-erro" role="alert"></p>
      <button class="btn link" id="voltar">Voltar</button></main>`);
    $('#voltar').onclick = () => telaParear();
    tecladoPin($('#pin'), async (pin) => {
      $('#pin-erro').textContent = ''; $('#pin-msg').textContent = 'Conferindo…';
      try {
        const { env, lig } = await cofre.abrirCodigo(codigo, pin);
        est.lig = lig; est.chave = await importarChave(lig.chaveSync);
        $('#pin-msg').textContent = 'Conferindo o acesso ao GitHub…';
        await repo().testar();
        await cofre.salvarLigacao(env);
        try { await navigator.storage?.persist?.(); } catch { /* sem problema */ } // pede ao iPhone para não limpar os dados do app
        est.dados = vazio(); est.sinc = null; est.cache = {};
        $('#pin-msg').textContent = 'Baixando seus dados… (só demora na primeira vez)';
        await sincronizar();
        if (est.erro) throw new Error(est.erro);
        abrirApp();
        avisar('Celular ligado ao PC. Tudo que você lançar aqui aparece lá.');
      } catch (e) {
        est.chave = null; est.lig = null;
        $('#pin-erro').textContent = e.message; $('#pin-msg').textContent = 'Digite o PIN do PC';
      }
    });
  };
}

// ---------- app ----------
function abrirApp() {
  aplicarTema(aparenciaEfetiva(est.dados.config));
  const ids = est.dados.meses.map((m) => m.id);
  const atual = faturaDaCompra(est.dados, hojeISO());
  est.mesId = ids.includes(atual) ? atual : ids.at(-1) || atual;
  montar(raiz, html`<header class="topo">
      <h1 id="titulo">Controle Financeiro</h1>
      <button class="icone-btn" id="status" aria-label="Sincronização">${I.nuvem}</button>
      <button class="icone-btn" data-ir="ajustes" aria-label="Ajustes">${I.engrenagem}</button>
    </header>
    <main id="conteudo"></main>
    <nav class="abas">${ABAS.map(([id, nome, ic]) => html`<button data-ir="${id}" class="${id === 'lancar' ? 'destaque' : ''}">${ic}<span>${nome}</span></button>`)}</nav>`);
  raiz.onclick = aoClicarGeral;
  desenhar();
}
function aoClicarGeral(e) {
  const b = e.target.closest('[data-ir]');
  if (b) { irPara(b.dataset.ir); return; }
  if (e.target.closest('#status')) { if (est.erro) avisar(est.erro, 'erro'); else avisar(est.ultima ? `Sincronizado às ${new Date(est.ultima).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.` : 'Sincronizando…'); sincronizar(); }
}
function irPara(tela) { est.tela = tela; desenhar(); $('#conteudo')?.scrollTo(0, 0); window.scrollTo(0, 0); }
function desenhar() {
  const alvo = $('#conteudo');
  if (!alvo || !est.dados) return;
  raiz.querySelectorAll('.abas [data-ir]').forEach((b) => b.classList.toggle('ativo', b.dataset.ir === (est.tela === 'gastos' ? 'inicio' : est.tela)));
  alvo.onchange = null; alvo.onclick = null; alvo.onkeydown = null; alvo.onfocusin = null; // cada tela liga os seus
  TELAS[est.tela].render(est, alvo, ctx);
  aplicarLarguras(alvo);
  desenharStatus();
}
let pendente = false;
function redesenharSeguro() {
  const ativo = document.activeElement;
  const digitando = ativo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ativo.tagName) && $('#conteudo')?.contains(ativo);
  if (est.tela === 'lancar' || digitando) { pendente = true; return; } // não apaga o que você está digitando
  desenhar();
}
function desenharStatus() {
  const s = $('#status');
  if (!s) return;
  s.classList.toggle('girando', est.sincronizando);
  s.classList.toggle('erro', !!est.erro && !est.sincronizando);
  s.classList.toggle('ok', !est.erro && !!est.ultima && !est.sincronizando);
}

async function desconectar() {
  if (!(await confirmar('Desligar este celular?', 'Apaga os dados guardados neste celular. Tudo continua no PC e no GitHub; para usar de novo, gere outro código no PC.', 'Desligar', true))) return;
  await cofre.apagarTudo();
  telaParear();
}
function bloquear() { clearTimeout(timerSync); telaPin('Bloqueado. Digite seu PIN'); }

const ctx = { salvar, irPara, redesenhar: desenhar, sincronizar, bloquear, desconectar };

// ---------- ciclo do app ----------
let escondidoEm = 0;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { escondidoEm = Date.now(); if (est.chave) sincronizar(); return; }
  if (!est.chave) return;
  if (escondidoEm && Date.now() - escondidoEm > BLOQUEAR_APOS) return bloquear();
  sincronizar();
  if (pendente && est.tela !== 'lancar') { pendente = false; desenhar(); }
});
window.addEventListener('online', () => { if (est.chave) sincronizar(); });
window.addEventListener('focusout', () => { if (pendente && est.tela !== 'lancar') setTimeout(() => { if (pendente && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) { pendente = false; desenhar(); } }, 50); });
export function marcarPendenteVisto() { if (pendente) { pendente = false; desenhar(); } }

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
aplicarTema(aparenciaEfetiva(null)); // tema guardado no celular já na tela do PIN
(async () => {
  try { if (await cofre.temLigacao()) telaPin(); else telaParear(); } catch (e) { montar(raiz, html`<main class="entrada"><h1>Controle Financeiro</h1><p class="erro">${e.message}</p></main>`); }
})();
