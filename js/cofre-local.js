// O que fica guardado NO CELULAR (IndexedDB), sempre criptografado:
//  - "ligacao": usuário/repositório/chave de acesso do GitHub + chave da sincronização, protegidos pelo PIN
//    (é o próprio "código para o celular" gerado no PC: PBKDF2-SHA256 600 mil voltas + AES-256-GCM);
//  - "dados": seus dados, criptografados com a chave da sincronização (256 bits aleatórios).
// Depois de 10 PINs errados seguidos, o celular apaga tudo (os dados continuam no PC e no GitHub).
import { derivarChave, cifrar, decifrar, importarChave, novoSal } from './comum/sync/cripto.js';

const BANCO = 'controle-financeiro';
const MAX_FALHAS = 10;

function abrirBanco() {
  return new Promise((ok, erro) => {
    const r = indexedDB.open(BANCO, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}
async function op(modo, fn) {
  const db = await abrirBanco();
  try {
    return await new Promise((ok, erro) => {
      const t = db.transaction('kv', modo);
      const req = fn(t.objectStore('kv'));
      t.oncomplete = () => ok(req && req.result);
      t.onerror = () => erro(t.error);
      t.onabort = () => erro(t.error || new Error('Não foi possível gravar no celular.'));
    });
  } finally { db.close(); }
}
const ler = (k) => op('readonly', (s) => s.get(k));
const gravar = (k, v) => op('readwrite', (s) => s.put(v, k));

export async function temLigacao() { return !!(await ler('ligacao')); }

// Código "CF2.…" do PC + PIN -> dados da ligação (lança erro se o PIN ou o código estiverem errados)
export async function abrirCodigo(codigo, pin) {
  const txt = String(codigo || '').trim().replace(/\s+/g, '');
  if (!/^CF2\.[A-Za-z0-9_-]+$/.test(txt)) throw new Error('Esse não parece o código do PC (começa com CF2.). Gere um novo em Configurações → Celular e sincronização.');
  let env;
  try { env = JSON.parse(atob(txt.slice(4).replace(/-/g, '+').replace(/_/g, '/'))); } catch { throw new Error('Código incompleto. Copie o código inteiro de novo.'); }
  let lig;
  try { lig = await decifrar(await derivarChave(pin, env.kdf.sal, env.kdf.iteracoes), env); } catch { throw new Error('PIN errado (ou o código foi gerado com outro PIN).'); }
  if (!lig || !lig.token || !lig.chaveSync || !lig.sal) throw new Error('Código antigo. Gere um novo no PC.');
  return { env, lig };
}
export async function salvarLigacao(env) { await gravar('ligacao', env); await gravar('falhas', { n: 0, ate: 0 }); }

// Abre com o PIN. Devolve { lig, chave }
export async function abrirComPin(pin) {
  const env = await ler('ligacao');
  if (!env) throw new Error('Este celular ainda não está ligado ao PC.');
  const f = (await ler('falhas')) || { n: 0, ate: 0 };
  if (Date.now() < f.ate) throw new Error(`Muitas tentativas. Aguarde ${Math.ceil((f.ate - Date.now()) / 1000)}s.`);
  let lig;
  try { lig = await decifrar(await derivarChave(pin, env.kdf.sal, env.kdf.iteracoes), env); } catch {
    f.n += 1;
    if (f.n >= MAX_FALHAS) { await apagarTudo(); throw new Error('PIN errado 10 vezes: os dados deste celular foram apagados. Ligue de novo com o código do PC.'); }
    f.ate = f.n >= 3 ? Date.now() + Math.min(2 ** (f.n - 2), 300) * 1000 : 0;
    await gravar('falhas', f);
    throw new Error(`PIN incorreto. ${MAX_FALHAS - f.n} tentativa(s) antes de apagar os dados deste celular.`);
  }
  await gravar('falhas', { n: 0, ate: 0 });
  return { lig, chave: await importarChave(lig.chaveSync) };
}

export async function trocarPin(atual, novo) {
  if (!/^\d{6}$/.test(novo)) throw new Error('O PIN novo precisa ter 6 números.');
  const { lig } = await abrirComPin(atual);
  const sal = novoSal();
  await gravar('ligacao', await cifrar(await derivarChave(novo, sal), sal, lig));
}

// Dados (com o estado da sincronização e a cópia dos pedaços da nuvem)
export async function lerDados(chave) {
  const env = await ler('dados');
  if (!env) return null;
  return decifrar(chave, env);
}
export async function salvarDados(chave, sal, pacote) { await gravar('dados', await cifrar(chave, sal, pacote)); }

export async function apagarTudo() {
  await new Promise((ok) => { const r = indexedDB.deleteDatabase(BANCO); r.onsuccess = r.onerror = r.onblocked = () => ok(); });
}
