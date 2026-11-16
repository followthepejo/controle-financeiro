// GERADO por scripts/montar-celular.js a partir de app/renderer/js — não edite aqui.
// Pessoas do cartão e categorias: adicionar, renomear e remover — as MESMAS regras no PC e no celular.
// Renomear atualiza tudo que usa o nome (meses, cartão, nomes aprendidos dos prints), para nada ficar órfão.

const igual = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

// ---------- categorias ----------
export function usoCategoria(d, nome) {
  let n = 0;
  for (const m of d.meses) for (const g of m.gastos) if (g.tipo === nome) n++;
  for (const c of d.cartao) if (c.tipo === nome) n++;
  return n;
}
export function adicionarCategoria(d, nome, operacao) {
  nome = String(nome || '').trim().slice(0, 60);
  if (!nome) throw new Error('Digite o nome da categoria.');
  if (d.categorias.some((k) => igual(k.nome, nome))) throw new Error('Essa categoria já existe.');
  d.categorias.push({ nome, operacao: ['Crédito', 'Débito', '-'].includes(operacao) ? operacao : 'Crédito' });
}
export function renomearCategoria(d, antigo, novo) {
  novo = String(novo || '').trim().slice(0, 60);
  const k = d.categorias.find((x) => x.nome === antigo);
  if (!k) throw new Error('Categoria não encontrada.');
  if (!novo) throw new Error('O nome não pode ficar vazio.');
  if (novo === antigo) return 0;
  if (d.categorias.some((x) => x !== k && igual(x.nome, novo))) throw new Error('Já existe uma categoria com esse nome.');
  let n = 0;
  for (const m of d.meses) for (const g of m.gastos) if (g.tipo === antigo) { g.tipo = novo; n++; }
  for (const c of d.cartao) if (c.tipo === antigo) { c.tipo = novo; n++; }
  for (const ap of Object.values(d.apelidos || {})) {
    if (ap.tipo === antigo) ap.tipo = novo;
    if (Array.isArray(ap.tipos)) ap.tipos = ap.tipos.map((t) => (t === antigo ? novo : t));
  }
  k.nome = novo;
  return n;
}
export function apagarCategoria(d, nome) {
  d.categorias = d.categorias.filter((x) => x.nome !== nome);
  let n = 0;
  for (const m of d.meses) for (const g of m.gastos) if (g.tipo === nome) { g.tipo = ''; n++; }
  for (const c of d.cartao) if (c.tipo === nome) { delete c.tipo; n++; }
  for (const ap of Object.values(d.apelidos || {})) if (ap.tipo === nome) ap.tipo = '';
  return n;
}

// ---------- pessoas ----------
export const usoPessoa = (d, nome) => d.cartao.filter((c) => c.quem === nome).length;
export function adicionarPessoa(d, nome) {
  nome = String(nome || '').trim().slice(0, 40);
  if (!nome) throw new Error('Digite o nome.');
  if (d.config.pessoas.some((p) => igual(p, nome))) throw new Error('Essa pessoa já existe.');
  d.config.pessoas.push(nome);
}
export function renomearPessoa(d, antigo, novo) {
  novo = String(novo || '').trim().slice(0, 40);
  if (!novo) throw new Error('O nome não pode ficar vazio.');
  if (novo === antigo) return 0;
  if (d.config.pessoas.some((p) => p !== antigo && igual(p, novo))) throw new Error('Já existe uma pessoa com esse nome.');
  d.config.pessoas = d.config.pessoas.map((p) => (p === antigo ? novo : p));
  if (d.config.pessoaPadrao === antigo) d.config.pessoaPadrao = novo;
  let n = 0;
  for (const c of d.cartao) if (c.quem === antigo) { c.quem = novo; n++; }
  return n;
}
// Os lançamentos dessa pessoa continuam no cartão (com o nome dela); só sai da lista de pessoas.
export function removerPessoa(d, nome) {
  if (nome === d.config.pessoaPadrao) throw new Error('Você (dono do app) não pode ser removido. Renomeie, se quiser.');
  if (d.config.pessoas.length <= 1) throw new Error('Precisa ficar pelo menos uma pessoa.');
  d.config.pessoas = d.config.pessoas.filter((p) => p !== nome);
}
