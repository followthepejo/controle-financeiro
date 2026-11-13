// GERADO por scripts/montar-celular.js a partir de app/renderer/js — não edite aqui.
// Regras para lançar gastos (do print ou digitados) — as MESMAS no PC e no celular.
// Os gastos de quem é o "dono" (pessoa padrão) entram no mês e no cartão; os das outras pessoas, só no cartão.
import { novoId, norm } from './util.js';
import { mesAlvo, conciliar, existeNoCartao, acharNoCartao, chaveNome, garantirNoCartao } from './conciliar.js';
import { assinaturaConhecida } from './assinaturas.js';
import { sugerirCategoria, operacaoDe, faturaDaCompra } from './calculos.js';

// Resultado da leitura do print -> itens para conferência (com nomes e categorias que você já usou)
export function prepararLidos(d, lidos, quem, mapa) {
  const cats = d.categorias;
  return lidos.map((l) => {
    const total = l.parcela_total || 1; const atual = l.parcela_atual || 1;
    const ap = (d.apelidos || {})[chaveNome(l.descricao)];
    const catSalva = ap && ap.tipo && !ap.catConflito && cats.some((c) => c.nome === ap.tipo) ? ap.tipo : '';
    const sugestaoLocal = catSalva || sugerirCategoria(d, mapa, ap && !ap.conflito && ap.nome ? ap.nome : l.descricao) || sugerirCategoria(d, mapa, l.descricao);
    const tipo = sugestaoLocal || (cats.some((c) => c.nome === l.categoria_sugerida) ? l.categoria_sugerida : '');
    const assin = assinaturaConhecida(d, ap && !ap.conflito && ap.nome ? ap.nome : l.descricao, l.valor) || assinaturaConhecida(d, l.descricao, l.valor);
    const nomeFinal = ap && !ap.conflito && ap.nome ? ap.nome : l.descricao;
    let tipoFinal = assin ? (cats.find((c) => norm(c.nome) === 'assinatura')?.nome || tipo) : tipo;
    if (l.debito && tipoFinal) tipoFinal = paraDebito(d, tipoFinal);
    return {
      lido: l.descricao, nomeSalvo: nomeFinal !== l.descricao, catSalva: !!catSalva, data: l.data || '', descricao: nomeFinal, valor: l.tipo === 'estorno' ? -Math.abs(l.valor) : Math.abs(l.valor),
      parcela: assin ? 'Fixo' : total > 1 ? `${atual}/${total}` : '1/1', tipo: tipoFinal, assinatura: !!assin, estorno: l.tipo === 'estorno',
      pagamento: l.tipo === 'pagamento' || l.tipo === 'entrada', marcado: true, quem, acao: null,
      ...(l.debito ? { debito: true, meio: l.meio || 'Débito' } : {}),
    };
  });
}

// Gasto pago no débito/Pix: usa a versão "débito" da categoria (LancheC -> LancheD), se existir; senão deixa para você escolher
export function paraDebito(d, tipo) {
  if (operacaoDe(d, tipo) === 'Débito') return tipo;
  const alt = d.categorias.find((c) => c.operacao === 'Débito' && (c.nome === tipo.replace(/C$/, 'D') || norm(c.nome) === norm(tipo.replace(/C$/, '')) + 'd'));
  return alt ? alt.nome : '';
}

// Marca cada item: 'novo' | 'completar' | 'existe' (já lançado no mês ou no cartão)
export function classificar(d, destino, itens) {
  if (!itens) return;
  const { mes } = mesAlvo(d, destino);
  const meus = itens.filter((x) => x.quem === d.config.pessoaPadrao);
  conciliar(mes, meus);
  const fatDe = (dt) => faturaDaCompra(d, dt);
  for (const x of itens) {
    const antes = x.acao;
    x.soCartao = x.quem !== d.config.pessoaPadrao;
    if (x.soCartao) { const c = acharNoCartao(d, x, fatDe); x.acao = c ? 'existe' : 'novo'; x.alvoDescricao = c ? `no cartão (${c.quem}: ${c.descricao})` : ''; x.completa = []; }
    else if (x.acao === 'novo') {
      // seu gasto, mas a compra já está no cartão como de outra pessoa: provavelmente não é seu
      const c = acharNoCartao(d, x, fatDe);
      if (c && c.quem !== x.quem) { x.acao = 'existe'; x.alvoDescricao = `no cartão como de ${c.quem}: ${c.descricao}`; }
    }
    const fat = faturaDaCompra(d, x.data);
    x.outraFatura = fat && fat !== destino && x.parcela === '1/1' && x.acao === 'novo' ? fat : null;
    if (antes !== x.acao) x.marcado = !x.pagamento && x.acao !== 'existe'; // não desfaz o que você marcou à mão
  }
}

// Lança os itens ativos na fatura "destino". Devolve o mês e as contagens.
export function aplicar(d, destino, ativos, { noCartao: levarAoCartao = true } = {}) {
  const eu = d.config.pessoaPadrao;
  const alvo = mesAlvo(d, destino);
  const mes = alvo.mes;
  if (alvo.novo) { d.meses.push(mes); d.meses.sort((a, b) => a.id.localeCompare(b.id)); for (const g of mes.gastos) garantirNoCartao(d, mes, g); }
  let novos = 0; let completados = 0; let noCartao = 0;
  const fatDe = (dt) => faturaDaCompra(d, dt);
  for (const x of ativos) {
    if (x.quem === eu) {
      if (x.acao === 'completar') {
        const g = mes.gastos.find((y) => y.id === x.alvo);
        if (g) { if (!g.data && x.data) g.data = x.data; if (!g.tipo && x.tipo) g.tipo = x.tipo; if (!g.parcela && x.parcela) g.parcela = x.parcela; if (x.completa.includes('valor')) g.valor = x.valor; completados++; }
      } else {
        mes.gastos.push({ id: novoId(), data: x.data, descricao: x.descricao, valor: x.valor, parcela: x.parcela, tipo: x.tipo, origem: x.origem || 'print' });
        novos++;
      }
      if (!levarAoCartao || x.debito || operacaoDe(d, x.tipo) === 'Débito') continue; // débito/Pix não é cartão
    }
    if (!existeNoCartao(d, x, x.quem, fatDe)) {
      d.cartao.push({ id: novoId(), data: x.data, quem: x.quem, descricao: x.descricao, valor: x.valor, pgto: 0, parcelas: x.parcela, ...(x.tipo ? { tipo: x.tipo } : {}) });
      noCartao++;
    }
  }
  return { mes, novos, completados, noCartao };
}

// Aprende os nomes e categorias que você usou (nome lido no print -> seu nome). Dois nomes diferentes = não troca mais sozinho.
export function aprenderApelidos(d, sel) {
  d.apelidos = d.apelidos || {};
  for (const x of sel) {
    if (!x.lido || !x.descricao) continue;
    const k = chaveNome(x.lido); if (!k) continue;
    const trocouNome = x.descricao !== x.lido;
    if (!trocouNome && !x.tipo && !d.apelidos[k]) continue;
    const ap = d.apelidos[k] || (d.apelidos[k] = { lido: x.lido, nome: '', conflito: false, nomes: [], tipo: '', catConflito: false, tipos: [] });
    if (trocouNome) {
      if (!ap.nomes.includes(x.descricao)) ap.nomes.push(x.descricao);
      if (!ap.nome) ap.nome = x.descricao; else if (ap.nome !== x.descricao) ap.conflito = true;
    }
    if (x.tipo) {
      if (!ap.tipos.includes(x.tipo)) ap.tipos.push(x.tipo);
      if (!ap.tipo) ap.tipo = x.tipo; else if (ap.tipo !== x.tipo) ap.catConflito = true;
    }
  }
}
