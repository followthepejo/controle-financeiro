// Ajustes do celular: sincronização, aparência, pessoas do cartão, categorias, PIN deste celular, bloquear e desligar.
import { html, montar, $, avisar, confirmar } from '../comum/util.js';
import { adicionarPessoa, renomearPessoa, removerPessoa, usoPessoa, adicionarCategoria, renomearCategoria, apagarCategoria, usoCategoria } from '../comum/cadastros.js';
import * as cofre from '../cofre-local.js';
import { abrirTema, aplicarTema, aparenciaEfetiva, lerAparencia } from '../tema.js';
import { I } from '../ui.js';

const OPS = [['Crédito', 'Crédito'], ['Débito', 'Débito'], ['-', 'Fora do cartão']];

export function render(est, raiz, ctx) {
  const d = est.dados;
  const cats = [...d.categorias].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const quando = est.ultima ? new Date(est.ultima).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'ainda não';
  montar(raiz, html`
    <h2 class="titulo-tela">Ajustes</h2>
    <section class="cartao">
      <h3>Sincronização com o PC</h3>
      <p class="sutil">Última: <b>${quando}</b>${est.sincronizando ? ' · sincronizando…' : ''}</p>
      ${est.erro ? html`<p class="faixa-aviso">${I.alerta} ${est.erro}</p>` : ''}
      <button class="btn primario" id="sinc">${I.sync} Sincronizar agora</button>
      <p class="sutil pequeno">Repositório privado: ${est.lig.dono}/${est.lig.repo}. Tudo vai criptografado; o GitHub só guarda arquivos embaralhados.</p>
    </section>
    <section class="cartao">
      <h3>Aparência</h3>
      <p class="sutil">${lerAparencia().seguirPC ? 'Usando o mesmo tema do PC.' : 'Tema próprio deste celular.'}</p>
      <button class="btn" id="tema">Tema, cores, fonte e animação</button>
    </section>
    <section class="cartao">
      <h3>Pessoas do cartão</h3>
      <ul class="lista-cadastro" id="pessoas">${d.config.pessoas.map((p) => html`<li data-pessoa="${p}">
        <input value="${p}" maxlength="40" aria-label="Nome">
        <small class="sutil">${p === d.config.pessoaPadrao ? 'você' : `${usoPessoa(d, p)} lanç.`}</small>
        ${p === d.config.pessoaPadrao ? html`<span class="icone-btn pequeno"></span>` : html`<button class="icone-btn pequeno" data-tirar-pessoa aria-label="Remover">${I.lixo}</button>`}</li>`)}</ul>
      <form class="form-linha-cel" id="form-pessoa" autocomplete="off"><input name="nome" placeholder="Nova pessoa" maxlength="40" required><button class="btn" type="submit" aria-label="Adicionar">${I.mais}</button></form>
      <p class="sutil pequeno">Renomear muda o nome em todos os lançamentos do cartão. Remover tira só da lista: os lançamentos dela continuam.</p>
    </section>
    <section class="cartao">
      <h3>Categorias</h3>
      <form class="form-linha-cel" id="form-cat" autocomplete="off"><input name="nome" placeholder="Nova categoria" maxlength="60" required>
        <select name="op" aria-label="Operação">${OPS.map(([v, r]) => html`<option value="${v}">${r}</option>`)}</select><button class="btn" type="submit" aria-label="Adicionar">${I.mais}</button></form>
      <ul class="lista-cadastro" id="cats">${cats.map((c) => html`<li data-cat="${c.nome}">
        <input value="${c.nome}" maxlength="60" aria-label="Nome" data-c="nome">
        <select data-c="op" aria-label="Operação">${OPS.map(([v, r]) => html`<option value="${v}" ${v === c.operacao ? 'selected' : ''}>${r}</option>`)}</select>
        <small class="sutil">${usoCategoria(d, c.nome)}</small>
        <button class="icone-btn pequeno" data-tirar-cat aria-label="Apagar">${I.lixo}</button></li>`)}</ul>
      <p class="sutil pequeno">O número é quantos lançamentos usam a categoria. Renomear atualiza todos (mês e cartão).</p>
    </section>
    <section class="cartao">
      <h3>PIN deste celular</h3>
      <form id="form-pin" class="form-coluna" autocomplete="off">
        <input name="atual" type="password" inputmode="numeric" maxlength="6" placeholder="PIN atual" required>
        <input name="novo" type="password" inputmode="numeric" maxlength="6" placeholder="PIN novo (6 números)" required>
        <input name="conf" type="password" inputmode="numeric" maxlength="6" placeholder="Repita o PIN novo" required>
        <button class="btn" type="submit">Trocar PIN</button>
      </form>
      <p class="sutil pequeno">Muda só o PIN do celular. O do PC você troca no PC. Fora do app por mais de 5 minutos, ele pede o PIN de novo.</p>
    </section>
    <section class="cartao">
      <button class="btn" id="bloquear">${I.cadeado} Bloquear agora</button>
      <button class="btn perigo" id="desligar">Desligar este celular</button>
    </section>`);

  $('#sinc').onclick = async () => { await ctx.sincronizar(); avisar(est.erro ? est.erro : 'Sincronizado.', est.erro ? 'erro' : 'info'); ctx.redesenhar(); };
  raiz.querySelectorAll('#form-pin input').forEach((i) => i.addEventListener('input', () => { i.value = i.value.replace(/\D/g, '').slice(0, 6); }));
  $('#form-pin').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.novo.value !== f.conf.value) return avisar('Os PINs novos não conferem.', 'erro');
    try { await cofre.trocarPin(f.atual.value, f.novo.value); f.reset(); avisar('PIN do celular trocado.'); } catch (er) { avisar(er.message, 'erro'); }
  };

  // ---------- pessoas ----------
  const pronto = async (msg) => { await ctx.salvar(); if (msg) avisar(msg); ctx.redesenhar(); };
  $('#form-pessoa').onsubmit = async (e) => { e.preventDefault(); try { adicionarPessoa(d, e.target.nome.value); await pronto('Pessoa adicionada.'); } catch (er) { avisar(er.message, 'erro'); } };
  $('#pessoas').addEventListener('change', async (e) => {
    const li = e.target.closest('[data-pessoa]'); if (!li) return;
    try { const n = renomearPessoa(d, li.dataset.pessoa, e.target.value); await pronto(n ? `Nome trocado em ${n} lançamento(s) do cartão.` : 'Nome trocado.'); }
    catch (er) { avisar(er.message, 'erro'); e.target.value = li.dataset.pessoa; }
  });
  $('#pessoas').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-tirar-pessoa]'); if (!b) return;
    const nome = b.closest('[data-pessoa]').dataset.pessoa; const n = usoPessoa(d, nome);
    if (!(await confirmar(`Remover ${nome}?`, n ? `Ela tem ${n} lançamento(s) no cartão, que continuam lá com o nome dela.` : 'Ela não tem lançamentos no cartão.', 'Remover', true))) return;
    try { removerPessoa(d, nome); await pronto(`${nome} saiu da lista.`); } catch (er) { avisar(er.message, 'erro'); }
  });

  // ---------- categorias ----------
  $('#form-cat').onsubmit = async (e) => { e.preventDefault(); try { adicionarCategoria(d, e.target.nome.value, e.target.op.value); await pronto('Categoria adicionada.'); } catch (er) { avisar(er.message, 'erro'); } };
  $('#cats').addEventListener('change', async (e) => {
    const li = e.target.closest('[data-cat]'); if (!li) return;
    const k = d.categorias.find((x) => x.nome === li.dataset.cat); if (!k) return;
    if (e.target.dataset.c === 'op') { k.operacao = e.target.value; await pronto('Operação da categoria trocada.'); return; }
    try { const n = renomearCategoria(d, k.nome, e.target.value); await pronto(n ? `Categoria renomeada em ${n} lançamento(s).` : 'Categoria renomeada.'); }
    catch (er) { avisar(er.message, 'erro'); e.target.value = k.nome; }
  });
  $('#cats').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-tirar-cat]'); if (!b) return;
    const nome = b.closest('[data-cat]').dataset.cat; const n = usoCategoria(d, nome);
    if (!(await confirmar(`Apagar "${nome}"?`, n ? `Ela é usada em ${n} lançamento(s), que ficarão sem categoria.` : 'Ela não é usada em nenhum lançamento.', 'Apagar', true))) return;
    apagarCategoria(d, nome); await pronto('Categoria apagada.');
  });

  $('#tema').onclick = () => abrirTema(est.dados.config, () => { aplicarTema(aparenciaEfetiva(est.dados.config)); ctx.redesenhar(); });
  $('#bloquear').onclick = () => ctx.bloquear();
  $('#desligar').onclick = () => ctx.desconectar();
}
