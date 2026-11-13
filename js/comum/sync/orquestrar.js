// GERADO por scripts/montar-celular.js a partir de app/renderer/js — não edite aqui.
// Uma sincronização completa com o repositório (igual no PC e no celular).
import { mesclar, estadoVazio } from './sincronizar.js';
import { dividir, juntar, selarPedaco, abrirPedaco, salDoPedaco } from './github.js';

// repo: RepoGitHub | chave/sal: da senha | dados: os dados deste aparelho
// estado: estado da última sincronização deste aparelho | cache: { nome: { sha, pedaco } }
export async function sincronizarComRepo({ repo, chave, sal, dados, estado, cache = {}, agora = () => Date.now() }) {
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const lista = await repo.listar();
    const novoCache = {};
    const pedacos = new Map();
    for (const [nome, sha] of lista) {
      if (cache[nome] && cache[nome].sha === sha) { pedacos.set(nome, cache[nome].pedaco); novoCache[nome] = cache[nome]; continue; }
      const texto = await repo.baixar(nome);
      if (salDoPedaco(texto) !== sal) throw new Error('Os dados na nuvem foram gravados com outra chave. Gere um novo código para o celular no PC.');
      const p = await abrirPedaco(chave, texto);
      pedacos.set(nome, p); novoCache[nome] = { sha, pedaco: p };
    }
    const remoto = lista.size ? juntar(pedacos) : null;
    const r = mesclar(dados, estado || estadoVazio(), remoto, agora());

    // envia só os pedaços que mudaram
    let conflito = false; let enviados = 0;
    for (const [nome, p] of dividir(r.documento)) {
      const igual = novoCache[nome] && JSON.stringify(novoCache[nome].pedaco) === JSON.stringify(p);
      if (igual) continue;
      if (nome === 'apagados' && !Object.keys(p.apagados).length && !novoCache[nome]) continue;
      const g = await repo.gravar(nome, await selarPedaco(chave, sal, p), lista.get(nome) || null);
      if (g.conflito) { conflito = true; break; } // o outro aparelho gravou agora: começa de novo
      novoCache[nome] = { sha: g.sha, pedaco: p }; enviados++;
    }
    if (conflito) { cache = novoCache; continue; }
    return { dados: r.dados, estado: r.estado, cache: novoCache, resumo: { ...r.resumo, pedacosEnviados: enviados } };
  }
  throw new Error('Muitas alterações ao mesmo tempo. Tento de novo em instantes.');
}
