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

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function mostrarDetalheEmpresa(empresaId) {
  const empresa = dados.empresas.find(e => e.empresa_id === empresaId);
  if (!empresa) return;

  const detalhe = document.getElementById('empresa-detalhe');
  detalhe.innerHTML =
    fichaEmpresaHTML(empresa) +
    pessoasEmpresaHTML(empresaId) +
    cardsEmpresaHTML(empresaId);

  const btnEditar = document.getElementById('btn-editar-empresa');
  if (btnEditar) btnEditar.addEventListener('click', () => editarEmpresaForm(empresaId));

  detalhe.querySelectorAll('.card-link[data-card-id]').forEach(el => {
    el.addEventListener('click', () => {
      t.showCard(el.dataset.cardId).catch(() => {});
    });
  });
}

function fichaEmpresaHTML(empresa) {
  return `
    <div class="section">
      <div class="section-header">
        <h2>${esc(empresa.nome)}</h2>
        <button class="btn-link" id="btn-editar-empresa" title="Editar empresa">✏️ Editar</button>
      </div>
      <div class="info-row"><span class="label">Localização</span><span>${esc(empresa.localizacao) || '—'}</span></div>
      <div class="info-row"><span class="label">Setor</span><span>${esc(empresa.setor) || '—'}</span></div>
      ${empresa.setor === 'Restaurante' ? `<div class="info-row"><span class="label">Plano</span><span>${esc(empresa.plano) || '—'}</span></div>` : ''}
      ${empresa.data_inicio ? `<div class="info-row"><span class="label">Data de Início</span><span>${esc(empresa.data_inicio)}</span></div>` : ''}
      ${empresa.email ? `<div class="info-row"><span class="label">Email</span><span>${esc(empresa.email)}</span></div>` : ''}
      ${empresa.telefone ? `<div class="info-row"><span class="label">Telefone</span><span>${esc(empresa.telefone)}</span></div>` : ''}
      ${empresa.notas ? `<div class="info-row"><span class="label">Notas</span><span>${esc(empresa.notas)}</span></div>` : ''}
      <div class="info-row"><span class="label">Cor</span><span><span class="tag-dot" style="background:${hexDaCor(empresa.cor)}"></span>${esc(empresa.cor) || 'blue'}</span></div>
    </div>
  `;
}

function pessoasEmpresaHTML(empresaId) {
  const pessoaIds = [...new Set([
    ...dados.pessoaEmpresas.filter(pe => pe.empresa_id === empresaId).map(pe => pe.pessoa_id),
    ...dados.pessoas.filter(p => p.empresa_id === empresaId).map(p => p.pessoa_id)
  ])];
  const pessoas = pessoaIds.map(id => dados.pessoas.find(p => p.pessoa_id === id)).filter(Boolean);
  return `
    <div class="section">
      <h3>Pessoas (${pessoas.length})</h3>
      ${pessoas.length ? pessoas.map(p => `
        <div class="resultado-item">
          <strong>${esc(p.nome)} ${esc(p.apelido) || ''}</strong>
          <span>${esc(p.cargo) || ''}${p.email ? ' · ' + esc(p.email) : ''}</span>
        </div>
      `).join('') : `<p class="empty">Sem pessoas associadas.</p>`}
    </div>
  `;
}

function cardsEmpresaHTML(empresaId) {
  const cardMap = {};
  dados.boardCards.forEach(c => { cardMap[c.id] = c; });
  const assoc = dados.cardAssoc.filter(a => a.empresa_id === empresaId);
  return `
    <div class="section">
      <h3>Cards (${assoc.length})</h3>
      ${assoc.length ? assoc.map(a => {
        const card = cardMap[a.card_id];
        const pessoa = dados.pessoas.find(p => p.pessoa_id === a.pessoa_id);
        const nomePessoa = pessoa ? `${pessoa.nome} ${pessoa.apelido || ''}`.trim() : '';
        const dt = dataCriacaoDoCardId(a.card_id);
        const dataStr = dt ? 'Criado ' + dt.toLocaleDateString('pt-PT') : '';
        const meta = [dataStr, nomePessoa].filter(Boolean).join(' · ');
        if (card) {
          return `<div class="card-link" data-card-id="${a.card_id}"><strong>${esc(card.name)}</strong>${meta ? `<span>${esc(meta)}</span>` : ''}</div>`;
        }
        return `<div class="card-link card-indisponivel"><strong>(card noutro board)</strong>${meta ? `<span>${esc(meta)}</span>` : ''}</div>`;
      }).join('') : `<p class="empty">Sem cards associados.</p>`}
    </div>
  `;
}

function editarEmpresaForm(empresaId) {
  const empresa = dados.empresas.find(e => e.empresa_id === empresaId);
  if (!empresa) return;
  const corAtual = empresa.cor || 'blue';
  const detalhe = document.getElementById('empresa-detalhe');
  detalhe.innerHTML = `
    <div class="section">
      <h2>Editar empresa</h2>
      <div class="form-grid">
        <div class="form-group"><label>Nome *</label><input type="text" id="ed-nome" value="${esc(empresa.nome)}" /></div>
        <div class="form-group"><label>Localização *</label><input type="text" id="ed-localizacao" value="${esc(empresa.localizacao)}" /></div>
        <div class="form-group"><label>Setor *</label>
          <select id="ed-setor">
            <option value="">— Selecionar —</option>
            <option value="Restaurante" ${empresa.setor === 'Restaurante' ? 'selected' : ''}>Restaurante</option>
            <option value="Outro" ${empresa.setor === 'Outro' ? 'selected' : ''}>Outro</option>
          </select>
        </div>
        <div id="ed-form-restaurante" style="display:${empresa.setor === 'Restaurante' ? 'block' : 'none'};">
          <div class="form-group"><label>Plano</label>
            <select id="ed-plano">
              <option value="Sem Avença" ${empresa.plano === 'Sem Avença' ? 'selected' : ''}>Sem Avença</option>
              <option value="ARD" ${empresa.plano === 'ARD' ? 'selected' : ''}>ARD</option>
              <option value="ARD Pro" ${empresa.plano === 'ARD Pro' ? 'selected' : ''}>ARD Pro</option>
              <option value="ARD Premium" ${empresa.plano === 'ARD Premium' ? 'selected' : ''}>ARD Premium</option>
            </select>
          </div>
          <div id="ed-form-data" style="display:${(empresa.plano && empresa.plano !== 'Sem Avença') ? 'block' : 'none'};">
            <div class="form-group"><label>Data de Início</label><input type="date" id="ed-data-inicio" value="${esc(empresa.data_inicio)}" /></div>
          </div>
        </div>
        <div class="form-group"><label>Email</label><input type="email" id="ed-email" value="${esc(empresa.email)}" /></div>
        <div class="form-group"><label>Telefone</label><input type="text" id="ed-telefone" value="${esc(empresa.telefone)}" /></div>
      </div>
      <div class="form-group"><label>Notas</label><textarea id="ed-notas">${esc(empresa.notas)}</textarea></div>
      <div class="form-group"><label>Cor do badge</label>
        <div class="cor-palette" id="ed-cor-palette">
          ${TRELLO_CORES.map(c => `<button type="button" class="cor-swatch${c.nome === corAtual ? ' selecionado' : ''}" data-cor="${c.nome}" style="background:${c.hex}" title="${c.nome}"></button>`).join('')}
        </div>
      </div>
      <span class="field-error-msg" id="ed-aviso"></span>
      <div class="form-actions">
        <button id="ed-cancelar" class="btn-secondary">Cancelar</button>
        <button id="ed-guardar" class="btn-primary">Guardar</button>
      </div>
    </div>
  `;

  document.getElementById('ed-setor').addEventListener('change', function() {
    document.getElementById('ed-form-restaurante').style.display = this.value === 'Restaurante' ? 'block' : 'none';
  });
  document.getElementById('ed-plano').addEventListener('change', function() {
    document.getElementById('ed-form-data').style.display = this.value !== 'Sem Avença' ? 'block' : 'none';
  });
  document.querySelectorAll('#ed-cor-palette .cor-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('#ed-cor-palette .cor-swatch').forEach(s => s.classList.remove('selecionado'));
      sw.classList.add('selecionado');
    });
  });
  document.getElementById('ed-cancelar').addEventListener('click', () => mostrarDetalheEmpresa(empresaId));
  document.getElementById('ed-guardar').addEventListener('click', () => guardarEmpresa(empresaId));
}

async function guardarEmpresa(empresaId) {
  const nome = val('ed-nome').trim();
  const localizacao = val('ed-localizacao').trim();
  const setor = val('ed-setor');
  if (!nome || !localizacao || !setor) {
    document.getElementById('ed-aviso').textContent = 'Nome, localização e setor são obrigatórios.';
    return;
  }
  const plano = setor === 'Restaurante' ? val('ed-plano') : '';
  const data_inicio = (plano && plano !== 'Sem Avença') ? val('ed-data-inicio') : '';
  const cor = (document.querySelector('#ed-cor-palette .cor-swatch.selecionado') || { dataset: {} }).dataset.cor || 'blue';
  const atualizada = {
    nome,
    localizacao,
    setor,
    plano,
    data_inicio,
    email: val('ed-email').trim(),
    telefone: val('ed-telefone').trim(),
    notas: val('ed-notas').trim(),
    cor
  };
  const detalhe = document.getElementById('empresa-detalhe');
  detalhe.innerHTML = `<p class="empty">A guardar...</p>`;
  try {
    await SheetsAPI.updateEmpresa(token, empresaId, atualizada);
    const idx = dados.empresas.findIndex(e => e.empresa_id === empresaId);
    if (idx !== -1) dados.empresas[idx] = { ...dados.empresas[idx], ...atualizada };
    mostrarDetalheEmpresa(empresaId);
  } catch (err) {
    detalhe.innerHTML = `<p class="empty">Erro ao guardar: ${esc(err.message)}</p>`;
  }
}
