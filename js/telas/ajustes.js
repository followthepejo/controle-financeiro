// Ajustes do celular: sincronização, PIN deste celular, bloquear e desligar.
import { html, montar, $, avisar } from '../comum/util.js';
import * as cofre from '../cofre-local.js';
import { abrirTema, aplicarTema, aparenciaEfetiva, lerAparencia } from '../tema.js';
import { I } from '../ui.js';

export function render(est, raiz, ctx) {
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
      <button class="btn" id="tema">Tema, cores e fonte</button>
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
  $('#tema').onclick = () => abrirTema(est.dados.config, () => { aplicarTema(aparenciaEfetiva(est.dados.config)); ctx.redesenhar(); });
  $('#bloquear').onclick = () => ctx.bloquear();
  $('#desligar').onclick = () => ctx.desconectar();
}
