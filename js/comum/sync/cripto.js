// GERADO por scripts/montar-celular.js a partir de app/renderer/js — não edite aqui.
// Criptografia do arquivo de sincronização — igual no PC (Node) e no celular (navegador), via Web Crypto.
// Senha -> PBKDF2-SHA256 (600.000 voltas) -> chave AES-256-GCM. A nuvem só vê dados embaralhados.
const FORMATO = 'CFSYNC';
const VERSAO = 1;
const ITERACOES = 600000;
const sub = () => globalThis.crypto.subtle;
const b64 = (u8) => { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s); };
const deb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const aad = (env) => new TextEncoder().encode(JSON.stringify({ formato: env.formato, versao: env.versao, kdf: env.kdf }));

export async function derivarChave(senha, salB64, iteracoes = ITERACOES) {
  const base = await sub().importKey('raw', new TextEncoder().encode(String(senha).normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return sub().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: deb64(salB64), iterations: iteracoes },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

// Chave da sincronização: 256 bits aleatórios (não vem do PIN, que é curto demais para proteger a nuvem).
// Fica guardada no cofre do PC e no celular; o "sal" do envelope passa a servir de identificador dessa chave.
export function novaChave() { return b64(globalThis.crypto.getRandomValues(new Uint8Array(32))); }
export async function importarChave(b64Chave) {
  const bruta = deb64(b64Chave);
  if (bruta.length !== 32) throw new Error('Chave de sincronização inválida.');
  return sub().importKey('raw', bruta, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export function novoSal() { return b64(globalThis.crypto.getRandomValues(new Uint8Array(16))); }

export async function cifrar(chave, sal, objeto, iteracoes = ITERACOES) {
  const env = { formato: FORMATO, versao: VERSAO, kdf: { algo: 'pbkdf2-sha256', iteracoes, sal } };
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const dados = new Uint8Array(await sub().encrypt({ name: 'AES-GCM', iv, additionalData: aad(env) }, chave, new TextEncoder().encode(JSON.stringify(objeto))));
  return { ...env, iv: b64(iv), dados: b64(dados) };
}

export async function decifrar(chave, env) {
  if (!env || env.formato !== FORMATO || env.versao !== VERSAO) throw new Error('Arquivo de sincronização inválido.');
  try {
    const claro = await sub().decrypt({ name: 'AES-GCM', iv: deb64(env.iv), additionalData: aad(env) }, chave, deb64(env.dados));
    return JSON.parse(new TextDecoder().decode(claro));
  } catch { throw new Error('Senha errada ou arquivo alterado.'); }
}

// Lê os parâmetros do arquivo (para derivar a chave certa antes de abrir)
export function parametros(env) {
  if (!env || env.formato !== FORMATO) throw new Error('Arquivo de sincronização inválido.');
  if (!(env.kdf && env.kdf.algo === 'pbkdf2-sha256' && env.kdf.iteracoes >= 300000)) throw new Error('Parâmetros de segurança abaixo do mínimo.');
  return env.kdf;
}
export { ITERACOES };
