// ============================================================
// SEARCH.JS — Vista de pesquisa CRM board-level
// ============================================================

let t;
let token = null;
let dados = { empresas: [], pessoas: [], pessoaEmpresas: [], cardAssoc: [], boardId: null };

document.addEventListener('DOMContentLoaded', async () => {
  t = TrelloPowerUp.iframe({
    appKey: AURATUS_CONFIG.TRELLO_API_KEY,
    appName: 'Auratus CRM'
  });
  setupTabs();
  document.getElementById('tab-empresas').innerHTML = `<p class="empty">A carregar...</p>`;
  await carregarDados();
  renderEmpresasTab();
  renderPessoasTab();
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
    const [empresas, pessoas, pessoaEmpresas, cardAssoc, board] = await Promise.all([
      SheetsAPI.getEmpresas(token),
      SheetsAPI.getPessoas(token),
      SheetsAPI.getAllPessoaEmpresas(token).catch(() => []),
      SheetsAPI.getAllCardAssociacoes(token),
      t.board('id').catch(() => ({}))
    ]);
    dados = { empresas, pessoas, pessoaEmpresas, cardAssoc, boardId: board.id };
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

// ---- SEPARADOR PESSOAS ----

function renderPessoasTab() {
  const panel = document.getElementById('tab-pessoas');
  panel.innerHTML = `
    <div class="search-box">
      <input type="text" id="search-pessoa-board" placeholder="Pesquisar pessoa..." autocomplete="off" />
    </div>
    <div id="pessoa-resultados" class="resultados"></div>
    <div id="pessoa-detalhe"></div>
  `;

  const input = document.getElementById('search-pessoa-board');
  const resultados = document.getElementById('pessoa-resultados');

  input.addEventListener('input', function() {
    const q = this.value.toLowerCase().trim();
    document.getElementById('pessoa-detalhe').innerHTML = '';
    if (!q) { resultados.innerHTML = ''; return; }
    const filtradas = dados.pessoas.filter(p => `${p.nome} ${p.apelido || ''}`.toLowerCase().includes(q));
    resultados.innerHTML = filtradas.length
      ? filtradas.map(p => `
          <div class="resultado-item" data-pessoa-id="${p.pessoa_id}">
            <strong>${esc(p.nome)} ${esc(p.apelido) || ''}</strong>
            <span>${esc(p.cargo) || ''}${p.email ? ' · ' + esc(p.email) : ''}</span>
          </div>
        `).join('')
      : `<p class="empty">Nenhuma pessoa encontrada.</p>`;

    resultados.querySelectorAll('.resultado-item').forEach(item => {
      item.addEventListener('click', () => {
        const pessoa = dados.pessoas.find(p => p.pessoa_id === item.dataset.pessoaId);
        resultados.innerHTML = '';
        input.value = pessoa ? `${pessoa.nome} ${pessoa.apelido || ''}`.trim() : '';
        mostrarDetalhePessoa(item.dataset.pessoaId);
      });
    });
  });
}

function mostrarDetalhePessoa(pessoaId) {
  const pessoa = dados.pessoas.find(p => p.pessoa_id === pessoaId);
  if (!pessoa) return;

  const detalhe = document.getElementById('pessoa-detalhe');
  detalhe.innerHTML =
    fichaPessoaHTML(pessoa) +
    empresasPessoaHTML(pessoaId) +
    `<div class="section" id="cards-section-pessoa"><h3>Cards</h3><p class="empty">A carregar cards...</p></div>`;

  const btnEditar = document.getElementById('btn-editar-pessoa');
  if (btnEditar) btnEditar.addEventListener('click', () => editarPessoaForm(pessoaId));

  detalhe.querySelectorAll('.empresa-filtro').forEach(el => {
    el.addEventListener('click', () => {
      detalhe.querySelectorAll('.empresa-filtro').forEach(x => x.classList.remove('selecionado'));
      el.classList.add('selecionado');
      renderCardsPessoa(pessoaId, el.dataset.empresaId || null);
    });
  });

  const sel = detalhe.querySelector('.empresa-filtro.selecionado');
  renderCardsPessoa(pessoaId, sel && sel.dataset.empresaId ? sel.dataset.empresaId : null);
}

function fichaPessoaHTML(pessoa) {
  const nomeCompleto = `${pessoa.nome} ${pessoa.apelido || ''}`.trim();
  const campos = [];
  if (pessoa.cargo) campos.push(campoHTML('Cargo', esc(pessoa.cargo)));
  if (pessoa.funcao) campos.push(campoHTML('Função', esc(pessoa.funcao)));
  if (pessoa.email) campos.push(campoHTML('Email', esc(pessoa.email)));
  if (pessoa.telemovel) campos.push(campoHTML('Telemóvel', esc(pessoa.telemovel)));

  return `
    <div class="section ficha-empresa">
      <div class="section-header">
        <h2>${esc(nomeCompleto)}</h2>
        <button class="btn-link" id="btn-editar-pessoa" title="Editar pessoa">✏️ Editar</button>
      </div>
      <div class="form-grid">
        ${campos.join('')}
      </div>
    </div>
  `;
}

function empresasPessoaHTML(pessoaId) {
  const pessoa = dados.pessoas.find(p => p.pessoa_id === pessoaId);
  const empresaIds = [...new Set([
    ...dados.pessoaEmpresas.filter(pe => pe.pessoa_id === pessoaId).map(pe => pe.empresa_id),
    ...(pessoa && pessoa.empresa_id ? [pessoa.empresa_id] : [])
  ])];
  const empresas = empresaIds.map(id => dados.empresas.find(e => e.empresa_id === id)).filter(Boolean);
  const mostrarTodas = empresas.length > 1;
  return `
    <div class="section">
      <h3>Empresas (${empresas.length})</h3>
      ${empresas.length ? `<div class="pessoas-grid">
        ${mostrarTodas ? `<div class="resultado-item empresa-filtro selecionado" data-empresa-id="">
          <strong>Todas</strong>
          <span>Todos os cards da pessoa</span>
        </div>` : ''}
        ${empresas.map((e, i) => `
        <div class="resultado-item empresa-filtro${!mostrarTodas && i === 0 ? ' selecionado' : ''}" data-empresa-id="${esc(e.empresa_id)}">
          <strong>${esc(e.nome)}</strong>
          <span>${esc(e.localizacao) || ''}${e.setor ? ' · ' + esc(e.setor) : ''}</span>
        </div>
      `).join('')}</div>` : `<p class="empty">Sem empresas associadas.</p>`}
    </div>
  `;
}

function editarPessoaForm(pessoaId) {
  const pessoa = dados.pessoas.find(p => p.pessoa_id === pessoaId);
  if (!pessoa) return;
  const detalhe = document.getElementById('pessoa-detalhe');
  detalhe.innerHTML = `
    <div class="section">
      <h2>Editar pessoa</h2>
      <div class="form-grid">
        <div class="form-group"><label>Nome *</label><input type="text" id="ed-p-nome" value="${esc(pessoa.nome)}" /></div>
        <div class="form-group"><label>Apelido</label><input type="text" id="ed-p-apelido" value="${esc(pessoa.apelido)}" /></div>
        <div class="form-group"><label>Cargo</label><input type="text" id="ed-p-cargo" value="${esc(pessoa.cargo)}" /></div>
        <div class="form-group"><label>Função</label><input type="text" id="ed-p-funcao" value="${esc(pessoa.funcao)}" /></div>
        <div class="form-group"><label>Email</label><input type="email" id="ed-p-email" value="${esc(pessoa.email)}" /></div>
        <div class="form-group"><label>Telemóvel</label><input type="text" id="ed-p-telemovel" value="${esc(pessoa.telemovel)}" /></div>
      </div>
      <span class="field-error-msg" id="ed-p-aviso"></span>
      <div class="form-actions">
        <button id="ed-p-cancelar" class="btn-secondary">Cancelar</button>
        <button id="ed-p-guardar" class="btn-primary">Guardar</button>
      </div>
    </div>
  `;

  document.getElementById('ed-p-cancelar').addEventListener('click', () => mostrarDetalhePessoa(pessoaId));
  document.getElementById('ed-p-guardar').addEventListener('click', () => guardarPessoa(pessoaId));
}

async function guardarPessoa(pessoaId) {
  const nome = val('ed-p-nome').trim();
  if (!nome) {
    document.getElementById('ed-p-aviso').textContent = 'O nome é obrigatório.';
    return;
  }
  const atualizada = {
    nome,
    apelido: val('ed-p-apelido').trim(),
    cargo: val('ed-p-cargo').trim(),
    funcao: val('ed-p-funcao').trim(),
    email: val('ed-p-email').trim(),
    telemovel: val('ed-p-telemovel').trim()
  };
  const detalhe = document.getElementById('pessoa-detalhe');
  detalhe.innerHTML = `<p class="empty">A guardar...</p>`;
  try {
    await SheetsAPI.updatePessoa(token, pessoaId, atualizada);
    const idx = dados.pessoas.findIndex(p => p.pessoa_id === pessoaId);
    if (idx !== -1) dados.pessoas[idx] = { ...dados.pessoas[idx], ...atualizada };
    mostrarDetalhePessoa(pessoaId);
  } catch (err) {
    detalhe.innerHTML = `<p class="empty">Erro ao guardar: ${esc(err.message)}</p>`;
  }
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
    `<div class="section" id="cards-section"><h3>Cards</h3><p class="empty">A carregar cards...</p></div>`;

  const btnEditar = document.getElementById('btn-editar-empresa');
  if (btnEditar) btnEditar.addEventListener('click', () => editarEmpresaForm(empresaId));

  detalhe.querySelectorAll('.pessoa-filtro').forEach(el => {
    el.addEventListener('click', () => {
      detalhe.querySelectorAll('.pessoa-filtro').forEach(x => x.classList.remove('selecionado'));
      el.classList.add('selecionado');
      renderCardsEmpresa(empresaId, el.dataset.pessoaId || null);
    });
  });

  const sel = detalhe.querySelector('.pessoa-filtro.selecionado');
  renderCardsEmpresa(empresaId, sel && sel.dataset.pessoaId ? sel.dataset.pessoaId : null);
}

function campoHTML(label, valor) {
  return `<div class="campo"><label>${label}</label><div class="campo-valor">${valor}</div></div>`;
}

function fichaEmpresaHTML(empresa) {
  const campos = [
    campoHTML('Localização', esc(empresa.localizacao) || '—'),
    campoHTML('Setor', esc(empresa.setor) || '—')
  ];
  if (empresa.setor === 'Restaurante') campos.push(campoHTML('Plano', esc(empresa.plano) || '—'));
  if (empresa.data_inicio) campos.push(campoHTML('Data de Início', esc(empresa.data_inicio)));
  if (empresa.email) campos.push(campoHTML('Email', esc(empresa.email)));
  if (empresa.telefone) campos.push(campoHTML('Telefone', esc(empresa.telefone)));
  campos.push(campoHTML('Cor', `<span class="tag-dot" style="background:${hexDaCor(empresa.cor)}"></span>${esc(empresa.cor) || 'blue'}`));

  const cor = hexDaCor(empresa.cor || 'blue');
  return `
    <div class="section ficha-empresa" style="background:${cor}1a;border-color:${cor}66;">
      <div class="section-header">
        <h2>${esc(empresa.nome)}</h2>
        <button class="btn-link" id="btn-editar-empresa" title="Editar empresa">✏️ Editar</button>
      </div>
      <div class="form-grid">
        ${campos.join('')}
      </div>
      ${empresa.notas ? `<div class="campo"><label>Notas</label><div class="campo-valor">${esc(empresa.notas)}</div></div>` : ''}
    </div>
  `;
}

function pessoasEmpresaHTML(empresaId) {
  const pessoaIds = [...new Set([
    ...dados.pessoaEmpresas.filter(pe => pe.empresa_id === empresaId).map(pe => pe.pessoa_id),
    ...dados.pessoas.filter(p => p.empresa_id === empresaId).map(p => p.pessoa_id)
  ])];
  const pessoas = pessoaIds.map(id => dados.pessoas.find(p => p.pessoa_id === id)).filter(Boolean);
  const mostrarTodos = pessoas.length > 1;
  return `
    <div class="section">
      <h3>Pessoas (${pessoas.length})</h3>
      ${pessoas.length ? `<div class="pessoas-grid">
        ${mostrarTodos ? `<div class="resultado-item pessoa-filtro selecionado" data-pessoa-id="">
          <strong>Todos</strong>
          <span>Todos os cards da empresa</span>
        </div>` : ''}
        ${pessoas.map((p, i) => `
        <div class="resultado-item pessoa-filtro${!mostrarTodos && i === 0 ? ' selecionado' : ''}" data-pessoa-id="${esc(p.pessoa_id)}">
          <strong>${esc(p.nome)} ${esc(p.apelido) || ''}</strong>
          <span>${esc(p.cargo) || ''}${p.email ? ' · ' + esc(p.email) : ''}</span>
        </div>
      `).join('')}</div>` : `<p class="empty">Sem pessoas associadas.</p>`}
    </div>
  `;
}

let cardsCacheEmpresa = { chave: null, detalhes: null, customFields: null };
let cardsCachePessoa = { chave: null, detalhes: null, customFields: null };

async function renderCardsEmpresa(empresaId, pessoaId = null) {
  const section = document.getElementById('cards-section');
  if (!section) return;
  const todasAssoc = dados.cardAssoc.filter(a => a.empresa_id === empresaId);
  const filtrados = pessoaId ? todasAssoc.filter(a => a.pessoa_id === pessoaId) : todasAssoc;
  await renderCardsCore(section, todasAssoc, filtrados, cardsCacheEmpresa, empresaId, 'empresa',
    () => renderCardsEmpresa(empresaId, pessoaId));
}

async function renderCardsPessoa(pessoaId, empresaId = null) {
  const section = document.getElementById('cards-section-pessoa');
  if (!section) return;
  const todasAssoc = dados.cardAssoc.filter(a => a.pessoa_id === pessoaId);
  const filtrados = empresaId ? todasAssoc.filter(a => a.empresa_id === empresaId) : todasAssoc;
  await renderCardsCore(section, todasAssoc, filtrados, cardsCachePessoa, pessoaId, 'pessoa',
    () => renderCardsPessoa(pessoaId, empresaId));
}

async function renderCardsCore(section, todasAssoc, filtrados, cache, chave, contexto, reRender) {
  if (!todasAssoc.length) {
    section.innerHTML = `<h3>Cards (0)</h3><p class="empty">Sem cards associados.</p>`;
    return;
  }

  let restToken = null;
  try {
    const restApi = t.getRestApi();
    if (await restApi.isAuthorized()) {
      restToken = await restApi.getToken();
    }
  } catch (e) {}

  if (!restToken) {
    section.innerHTML = `
      <h3>Cards (${todasAssoc.length})</h3>
      <p class="empty">Autoriza o acesso ao Trello para veres o board, a lista e o estado de cada card.</p>
      <button id="btn-autorizar-trello" class="btn-secondary">Autorizar Trello</button>
    `;
    section.querySelector('#btn-autorizar-trello').addEventListener('click', async () => {
      try {
        await t.getRestApi().authorize({ scope: 'read', expiration: 'never' });
        reRender();
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        section.innerHTML = `<h3>Cards (${todasAssoc.length})</h3><p class="empty">Não foi possível autorizar o acesso ao Trello.<br>Detalhe: ${esc(msg)}</p>`;
      }
    });
    return;
  }

  let detalhes, customFields;
  if (cache.chave === chave && cache.detalhes) {
    detalhes = cache.detalhes;
    customFields = cache.customFields;
  } else {
    detalhes = await fetchCardsDetails(todasAssoc.map(a => a.card_id), restToken);
    const boardIds = [...new Set(Object.values(detalhes).map(d => d.idBoard).filter(Boolean))];
    customFields = await fetchCustomFieldsDefs(boardIds, restToken);
    cache.chave = chave;
    cache.detalhes = detalhes;
    cache.customFields = customFields;
  }

  renderCardsList(section, filtrados, detalhes, customFields, contexto);
}

function renderCardsList(section, assoc, detalhes, customFields, contexto) {
  if (!assoc.length) {
    section.innerHTML = `<h3>Cards (0)</h3><p class="empty">Sem cards.</p>`;
    return;
  }

  const ordenados = [...assoc].sort((a, b) => {
    const da = dataCriacaoDoCardId(a.card_id);
    const db = dataCriacaoDoCardId(b.card_id);
    return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
  });

  section.innerHTML = `<h3>Cards (${ordenados.length})</h3>` +
    ordenados.map(a => cardLinkHTML(a, detalhes[a.card_id], customFields, contexto)).join('');

  section.querySelectorAll('.card-link[data-card-id]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.cardId;
      const det = detalhes[id];
      if (det && det.idBoard === dados.boardId) {
        t.showCard(id).catch(() => { if (det.url) window.open(det.url, '_blank'); });
      } else if (det && det.url) {
        window.open(det.url, '_blank');
      } else {
        t.showCard(id).catch(() => {});
      }
    });
  });
}

async function fetchCardsDetails(cardIds, restToken) {
  const result = {};
  const key = AURATUS_CONFIG.TRELLO_API_KEY;
  await Promise.all(cardIds.map(async id => {
    try {
      const url = `https://api.trello.com/1/cards/${id}?key=${key}&token=${restToken}` +
        `&fields=name,closed,url,idBoard&board=true&board_fields=name&list=true&list_fields=name` +
        `&customFieldItems=true`;
      const res = await fetch(url);
      if (!res.ok) return;
      result[id] = await res.json();
    } catch (e) {}
  }));
  return result;
}

async function fetchCustomFieldsDefs(boardIds, restToken) {
  const porBoard = {};
  const key = AURATUS_CONFIG.TRELLO_API_KEY;
  await Promise.all(boardIds.map(async boardId => {
    try {
      const url = `https://api.trello.com/1/boards/${boardId}/customFields?key=${key}&token=${restToken}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const defs = await res.json();
      porBoard[boardId] = {};
      defs.forEach(d => { porBoard[boardId][d.id] = d; });
    } catch (e) {}
  }));
  return porBoard;
}

function cardLinkHTML(a, det, customFields, contexto) {
  let subLinha = '';
  if (contexto === 'pessoa') {
    const empresa = dados.empresas.find(e => e.empresa_id === a.empresa_id);
    subLinha = empresa ? empresa.nome : '';
  } else {
    const pessoa = dados.pessoas.find(p => p.pessoa_id === a.pessoa_id);
    subLinha = pessoa ? `${pessoa.nome} ${pessoa.apelido || ''}`.trim() : '';
  }
  const dt = dataCriacaoDoCardId(a.card_id);
  const dataStr = dt ? dt.toLocaleDateString('pt-PT') : '';

  const nome = det ? det.name : '(card não encontrado)';
  const boardNome = det && det.board ? det.board.name : '—';
  const listaNome = det && det.list ? det.list.name : '—';
  const arquivado = det ? det.closed : false;
  const estadoHTML = det
    ? `<span class="card-estado ${arquivado ? 'arquivado' : 'ativo'}">${arquivado ? 'Arquivado' : 'Ativo'}</span>`
    : '';

  const cfHTML = camposPersonalizadosHTML(det, customFields);
  const attrs = det ? ` class="card-link" data-card-id="${a.card_id}"` : ` class="card-link card-indisponivel"`;
  return `
    <div${attrs}>
      <div class="card-esq">
        <strong>${esc(nome)}</strong>
        ${dataStr ? `<span class="card-data">📅 ${esc(dataStr)}</span>` : ''}
        ${subLinha ? `<span>${esc(subLinha)}</span>` : ''}
      </div>
      ${cfHTML ? `<div class="card-meio">${cfHTML}</div>` : ''}
      <div class="card-dir">
        <span class="card-board">${esc(boardNome)}</span>
        <span class="card-lista">${esc(listaNome)}</span>
        ${estadoHTML}
      </div>
    </div>
  `;
}

function camposPersonalizadosHTML(det, customFields) {
  if (!det || !det.customFieldItems || !det.customFieldItems.length) return '';
  const defs = customFields && customFields[det.idBoard];
  if (!defs) return '';

  const linhas = [];
  det.customFieldItems.forEach(item => {
    const def = defs[item.idCustomField];
    if (!def) return;

    let valor = '';
    if (def.type === 'list') {
      const opt = (def.options || []).find(o => o.id === item.idValue);
      valor = opt && opt.value ? opt.value.text : '';
    } else if (item.value) {
      if (def.type === 'date' && item.value.date) {
        const d = new Date(item.value.date);
        valor = isNaN(d.getTime()) ? item.value.date : d.toLocaleDateString('pt-PT');
      } else if (def.type === 'checkbox') {
        valor = item.value.checked === 'true' ? 'Sim' : 'Não';
      } else if (item.value.text != null) {
        valor = item.value.text;
      } else if (item.value.number != null) {
        valor = item.value.number;
      }
    }
    if (valor === '' || valor == null) return;

    linhas.push(`<span class="card-cf"><span class="card-cf-nome">${esc(def.name)}:</span> ${esc(valor)}</span>`);
  });
  return linhas.join('');
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
