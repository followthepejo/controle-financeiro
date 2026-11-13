// GERADO por scripts/montar-celular.js a partir de app/renderer/js — não edite aqui.
// Guarda os dados sincronizados num repositório PRIVADO do GitHub, igual no PC e no celular.
// Os dados ficam divididos em vários arquivos (um por mês, o cartão por mês, base, cripto, apagados),
// cada um criptografado e compactado. Assim cada alteração envia só o pedaço que mudou.
import { cifrar, decifrar, parametros } from './cripto.js';

const API = 'https://api.github.com';
const PASTA = 'dados';

// Em qual arquivo fica cada registro
export function pedacoDe(chave, registroTexto) {
  if (chave.startsWith('mes:')) return `m-${chave.slice(4)}`;
  if (chave.startsWith('g:')) return `m-${chave.split(':')[1]}`;
  if (chave.startsWith('c:')) {
    let mes = 'sem-data';
    try { const d = JSON.parse(registroTexto).data; if (/^\d{4}-\d{2}/.test(d || '')) mes = d.slice(0, 7); } catch { /* sem data */ }
    return `c-${mes}`;
  }
  if (chave.startsWith('cm:') || chave.startsWith('ca:') || chave === 'cotacao') return 'cripto';
  return 'base';
}

// documento inteiro <-> pedaços
export function dividir(doc) {
  const pedacos = new Map();
  const pegar = (n) => { if (!pedacos.has(n)) pedacos.set(n, { registros: {} }); return pedacos.get(n); };
  for (const [k, r] of Object.entries(doc.registros)) pegar(pedacoDe(k, r.v)).registros[k] = r;
  pedacos.set('apagados', { apagados: doc.apagados || {} });
  return pedacos;
}
export function juntar(pedacos) {
  const doc = { registros: {}, apagados: {} };
  for (const [nome, p] of pedacos) {
    if (nome === 'apagados') Object.assign(doc.apagados, p.apagados || {});
    else for (const [k, r] of Object.entries(p.registros || {})) {
      // a mesma chave em dois pedaços (ex.: data alterada): fica a versão mais recente
      if (!doc.registros[k] || (r.t || 0) > (doc.registros[k].t || 0)) doc.registros[k] = r;
    }
  }
  return doc;
}

// compactar (gzip) antes de criptografar: o arquivo fica bem menor
async function gz(texto) {
  const s = new Blob([texto]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function ungz(bytes) {
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(s).text();
}
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
const deb64 = (s) => Uint8Array.from(atob(s.replace(/\s/g, '')), (c) => c.charCodeAt(0));

export async function selarPedaco(chave, sal, pedaco) {
  const z = await gz(JSON.stringify(pedaco));
  return JSON.stringify(await cifrar(chave, sal, { gz: b64(z) }));
}
export async function abrirPedaco(chave, texto) {
  const env = JSON.parse(texto);
  const o = await decifrar(chave, env);
  return JSON.parse(await ungz(deb64(o.gz)));
}
export function salDoPedaco(texto) { return parametros(JSON.parse(texto)).sal; }

export class RepoGitHub {
  constructor({ dono, repo, token, fetch: f }) {
    this.dono = dono; this.repo = repo; this.token = token;
    // no navegador (celular), nunca usar resposta guardada em cache: a lista precisa estar sempre atual
    const noNavegador = typeof window !== 'undefined';
    this.f = f || ((url, op = {}) => globalThis.fetch(url, noNavegador ? { cache: 'no-store', ...op } : op));
  }
  cab(extra = {}) { return { Authorization: `Bearer ${this.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...extra }; }
  url(caminho = '') { return `${API}/repos/${encodeURIComponent(this.dono)}/${encodeURIComponent(this.repo)}/contents/${PASTA}${caminho ? '/' + caminho : ''}`; }

  async erro(r, acao) {
    if (r.status === 401) return new Error('A chave de acesso do GitHub é inválida ou expirou.');
    if (r.status === 403) return new Error('A chave de acesso do GitHub não tem permissão para este repositório.');
    if (r.status === 404) return new Error('Repositório não encontrado. Confira o nome e se a chave tem acesso a ele.');
    return new Error(`GitHub respondeu ${r.status} ao ${acao}.`);
  }
  async testar() {
    const r = await this.f(`${API}/repos/${encodeURIComponent(this.dono)}/${encodeURIComponent(this.repo)}`, { headers: this.cab() });
    if (!r.ok) throw await this.erro(r, 'conferir o repositório');
    const j = await r.json();
    if (!j.private) throw new Error('Esse repositório é PÚBLICO. Por segurança, use um repositório privado.');
    return true;
  }
  // lista os pedaços: nome -> sha (o sha muda quando o arquivo muda)
  async listar() {
    const r = await this.f(this.url(), { headers: this.cab() });
    if (r.status === 404) return new Map();
    if (!r.ok) throw await this.erro(r, 'listar os dados');
    const lista = await r.json();
    return new Map(lista.filter((x) => x.type === 'file' && x.name.endsWith('.cf')).map((x) => [x.name.slice(0, -3), x.sha]));
  }
  async baixar(nome) {
    const r = await this.f(this.url(`${nome}.cf`), { headers: this.cab({ Accept: 'application/vnd.github.raw+json' }) });
    if (!r.ok) throw await this.erro(r, 'baixar os dados');
    return r.text();
  }
  // grava um pedaço; sha = versão que eu conhecia (null = arquivo novo). Devolve { sha } ou { conflito: true }
  async gravar(nome, texto, sha) {
    const corpo = { message: `sincronização: ${nome}`, content: btoa(texto) };
    if (sha) corpo.sha = sha;
    const r = await this.f(this.url(`${nome}.cf`), { method: 'PUT', headers: this.cab({ 'Content-Type': 'application/json' }), body: JSON.stringify(corpo) });
    if (r.status === 409 || r.status === 422) return { conflito: true };
    if (!r.ok) throw await this.erro(r, 'gravar os dados');
    const j = await r.json();
    return { sha: j.content.sha };
  }
}
