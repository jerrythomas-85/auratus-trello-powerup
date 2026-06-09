// ============================================================
// SEARCH.JS — Vista de pesquisa CRM board-level
// ============================================================

let t;
let token = null;
let dados = { empresas: [], pessoas: [], pessoaEmpresas: [], cardAssoc: [], boardCards: [] };

document.addEventListener('DOMContentLoaded', async () => {
  t = TrelloPowerUp.iframe();
  setupTabs();
  document.getElementById('tab-empresas').innerHTML = `<p class="empty">A carregar...</p>`;
  await carregarDados();
  renderEmpresasTab();
});

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });
}

async function carregarDados() {
  try {
    token = await Auth.ensureToken();
    const [empresas, pessoas, pessoaEmpresas, cardAssoc, boardCards] = await Promise.all([
      SheetsAPI.getEmpresas(token),
      SheetsAPI.getPessoas(token),
      SheetsAPI.getAllPessoaEmpresas(token).catch(() => []),
      SheetsAPI.getAllCardAssociacoes(token),
      t.cards('id', 'name').catch(() => [])
    ]);
    dados = { empresas, pessoas, pessoaEmpresas, cardAssoc, boardCards };
  } catch (err) {
    document.getElementById('tab-empresas').innerHTML = `<p class="empty">Erro: ${err.message}</p>`;
  }
}

// ---- SEPARADOR EMPRESAS ----

function renderEmpresasTab() {
  const panel = document.getElementById('tab-empresas');
  panel.innerHTML = `
    <div class="search-box">
      <input type="text" id="search-empresa-board" placeholder="Pesquisar empresa..." autocomplete="off" />
    </div>
    <div id="empresa-resultados" class="resultados"></div>
    <div id="empresa-detalhe"></div>
  `;

  const input = document.getElementById('search-empresa-board');
  const resultados = document.getElementById('empresa-resultados');

  input.addEventListener('input', function() {
    const q = this.value.toLowerCase().trim();
    document.getElementById('empresa-detalhe').innerHTML = '';
    if (!q) { resultados.innerHTML = ''; return; }
    const filtradas = dados.empresas.filter(e => e.nome.toLowerCase().includes(q));
    resultados.innerHTML = filtradas.length
      ? filtradas.map(e => `
          <div class="resultado-item" data-empresa-id="${e.empresa_id}">
            <strong>${e.nome}</strong>
            <span>${e.localizacao || ''}${e.setor ? ' · ' + e.setor : ''}</span>
          </div>
        `).join('')
      : `<p class="empty">Nenhuma empresa encontrada.</p>`;

    resultados.querySelectorAll('.resultado-item').forEach(item => {
      item.addEventListener('click', () => {
        const empresa = dados.empresas.find(e => e.empresa_id === item.dataset.empresaId);
        resultados.innerHTML = '';
        input.value = empresa ? empresa.nome : '';
        mostrarDetalheEmpresa(item.dataset.empresaId);
      });
    });
  });
}

// Data de criação de um card: os primeiros 8 hex do ID do Trello são o timestamp Unix.
function dataCriacaoDoCardId(cardId) {
  if (!cardId || cardId.length < 8) return null;
  const ts = parseInt(cardId.substring(0, 8), 16);
  if (isNaN(ts)) return null;
  return new Date(ts * 1000);
}

function mostrarDetalheEmpresa(empresaId) {
  const empresa = dados.empresas.find(e => e.empresa_id === empresaId);
  if (!empresa) return;

  const cardMap = {};
  dados.boardCards.forEach(c => { cardMap[c.id] = c; });

  const assoc = dados.cardAssoc.filter(a => a.empresa_id === empresaId);

  const pessoaIds = [...new Set([
    ...dados.pessoaEmpresas.filter(pe => pe.empresa_id === empresaId).map(pe => pe.pessoa_id),
    ...dados.pessoas.filter(p => p.empresa_id === empresaId).map(p => p.pessoa_id)
  ])];
  const pessoas = pessoaIds.map(id => dados.pessoas.find(p => p.pessoa_id === id)).filter(Boolean);

  const detalhe = document.getElementById('empresa-detalhe');
  detalhe.innerHTML = `
    <h2>${empresa.nome}</h2>
    <div class="detalhe-cols">
      <div class="detalhe-bloco">
        <h3>Cards (${assoc.length})</h3>
        ${assoc.length ? assoc.map(a => {
          const card = cardMap[a.card_id];
          const pessoa = dados.pessoas.find(p => p.pessoa_id === a.pessoa_id);
          const nomePessoa = pessoa ? `${pessoa.nome} ${pessoa.apelido || ''}`.trim() : '';
          const dt = dataCriacaoDoCardId(a.card_id);
          const dataStr = dt ? 'Criado ' + dt.toLocaleDateString('pt-PT') : '';
          const meta = [dataStr, nomePessoa].filter(Boolean).join(' · ');
          if (card) {
            return `<div class="card-link" data-card-id="${a.card_id}"><strong>${card.name}</strong>${meta ? `<span>${meta}</span>` : ''}</div>`;
          }
          return `<div class="card-link card-indisponivel"><strong>(card noutro board)</strong>${meta ? `<span>${meta}</span>` : ''}</div>`;
        }).join('') : `<p class="empty">Sem cards associados.</p>`}
      </div>
      <div class="detalhe-bloco">
        <h3>Pessoas (${pessoas.length})</h3>
        ${pessoas.length ? pessoas.map(p => `
          <div class="resultado-item">
            <strong>${p.nome} ${p.apelido || ''}</strong>
            <span>${p.cargo || ''}${p.email ? ' · ' + p.email : ''}</span>
          </div>
        `).join('') : `<p class="empty">Sem pessoas associadas.</p>`}
      </div>
    </div>
  `;

  detalhe.querySelectorAll('.card-link[data-card-id]').forEach(el => {
    el.addEventListener('click', () => {
      t.showCard(el.dataset.cardId).catch(() => {});
    });
  });
}
