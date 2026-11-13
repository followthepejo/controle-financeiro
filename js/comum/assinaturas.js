// GERADO por scripts/montar-celular.js a partir de app/renderer/js — não edite aqui.
// Assinaturas conhecidas: nome + valor. Um lançamento é assinatura se o nome bate
// (mesma palavra principal, ou um contém o outro) e o valor está perto (até R$ 1 ou 5% de diferença).
import { norm } from './util.js';

const GENERICAS = new Set(['pro', 'premium', 'plus', 'club', 'max', 'one', 'app', 'pix', 'pg', 'mp', 'the', 'de', 'do', 'da', 'com', 'www', 'br']);
const limpo = (s) => norm(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
export const palavraPrincipal = (s) => limpo(s).split(' ').find((w) => w.length >= 2 && !GENERICAS.has(w)) || limpo(s).split(' ')[0] || '';

export function nomeBate(cadastro, descricao) {
  const a = limpo(cadastro).replace(/ /g, ''); const b = limpo(descricao).replace(/ /g, '');
  if (!a || !b) return false;
  if (a === b || b.includes(a) || a.includes(b)) return true;
  const pa = palavraPrincipal(cadastro); const pb = palavraPrincipal(descricao);
  return pa.length >= 3 && pa === pb;
}
const valorPerto = (a, b) => Math.abs(a - b) <= Math.max(1, 0.05 * Math.max(Math.abs(a), Math.abs(b)));

export function assinaturaConhecida(dados, descricao, valor) {
  return (dados.assinaturas || []).find((a) => nomeBate(a.nome, descricao) && (valor == null || !a.valor || valorPerto(a.valor, valor))) || null;
}
