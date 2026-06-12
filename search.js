// ============================================================
// SEARCH.JS — Vista de pesquisa CRM board-level
// ============================================================

let t;
let token = null;
let dados = { empresas: [], pessoas: [], pessoaEmpresas: [], cardAssoc: [], boardId: null };
let importLinhas = [];
let avencas = null; // lazy: null = ainda não carregadas
let avEmpresaSel = null; // empresa escolhida no formulário de avença

document.addEventListener('DOMContentLoaded', async () => {
  t = TrelloPowerUp.iframe({
    appKey: AURATUS_CONFIG.TRELLO_API_KEY,
    appName: 'Auratus CRM'
  });
  Auth.init(t);
  setupTabs();
  document.querySelector('.tab[data-tab="ard"]').addEventListener('click', renderArdTab);
  document.getElementById('tab-empresas').innerHTML = `<p class="empty">A carregar...</p>`;
  await carregarDados();
  renderEmpresasTab();
  renderPessoasTab();
  renderListaTab();
  renderImportarTab();
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
    <div class="topo-aba">
      <div class="search-box">
        <input type="text" id="search-empresa-board" placeholder="Pesquisar empresa..." autocomplete="off" />
      </div>
      <button id="btn-nova-empresa" class="btn-primary btn-novo">+ Nova empresa</button>
    </div>
    <div id="empresa-resultados" class="resultados"></div>
    <div id="empresa-detalhe"></div>
  `;

  const input = document.getElementById('search-empresa-board');
  const resultados = document.getElementById('empresa-resultados');
  document.getElementById('btn-nova-empresa').addEventListener('click', criarEmpresaForm);

  input.addEventListener('input', function() {
    const q = this.value.toLowerCase().trim();
    document.getElementById('empresa-detalhe').innerHTML = '';
    if (!q) { resultados.innerHTML = ''; return; }
    const filtradas = dados.empresas.filter(e => e.nome.toLowerCase().includes(q));
    resultados.innerHTML = filtradas.length
      ? filtradas.map(e => `
          <div class="resultado-item" data-empresa-id="${e.empresa_id}">
            <strong>${e.nome}</strong>
            <span>${e.distrito || e.localizacao || ''}${e.setor ? ' · ' + e.setor : ''}</span>
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
    <div class="topo-aba">
      <div class="search-box">
        <input type="text" id="search-pessoa-board" placeholder="Pesquisar pessoa..." autocomplete="off" />
      </div>
      <button id="btn-nova-pessoa" class="btn-primary btn-novo">+ Nova pessoa</button>
    </div>
    <div id="pessoa-resultados" class="resultados"></div>
    <div id="pessoa-detalhe"></div>
  `;

  const input = document.getElementById('search-pessoa-board');
  const resultados = document.getElementById('pessoa-resultados');
  document.getElementById('btn-nova-pessoa').addEventListener('click', criarPessoaForm);

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
  const btnApagar = document.getElementById('btn-apagar-pessoa');
  if (btnApagar) btnApagar.addEventListener('click', () => apagarPessoaConfirm(pessoaId));

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
        <span class="header-actions">
          <button class="btn-link" id="btn-editar-pessoa" title="Editar pessoa">✏️ Editar</button>
          <button class="btn-link btn-danger" id="btn-apagar-pessoa" title="Apagar pessoa">🗑️ Apagar</button>
        </span>
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
          <span>${esc(e.distrito) || esc(e.localizacao) || ''}${e.setor ? ' · ' + esc(e.setor) : ''}</span>
        </div>
      `).join('')}</div>` : `<p class="empty">Sem empresas associadas.</p>`}
    </div>
  `;
}

// ---- FORMULÁRIO DE PESSOA (partilhado entre criar e editar) ----
function pessoaCamposHTML(pessoa) {
  return `
      <div class="form-grid">
        <div class="form-group"><label>Nome *</label><input type="text" id="ed-p-nome" value="${esc(pessoa.nome || '')}" /></div>
        <div class="form-group"><label>Apelido</label><input type="text" id="ed-p-apelido" value="${esc(pessoa.apelido || '')}" /></div>
        <div class="form-group"><label>Cargo</label><input type="text" id="ed-p-cargo" value="${esc(pessoa.cargo || '')}" /></div>
        <div class="form-group"><label>Função</label><input type="text" id="ed-p-funcao" value="${esc(pessoa.funcao || '')}" /></div>
        <div class="form-group"><label>Email</label><input type="email" id="ed-p-email" value="${esc(pessoa.email || '')}" /></div>
        <div class="form-group"><label>Telemóvel</label><input type="text" id="ed-p-telemovel" value="${esc(pessoa.telemovel || '')}" /></div>
      </div>
  `;
}

function lerPessoaForm() {
  return {
    nome: val('ed-p-nome').trim(),
    apelido: val('ed-p-apelido').trim(),
    cargo: val('ed-p-cargo').trim(),
    funcao: val('ed-p-funcao').trim(),
    email: val('ed-p-email').trim(),
    telemovel: val('ed-p-telemovel').trim()
  };
}

function editarPessoaForm(pessoaId) {
  const pessoa = dados.pessoas.find(p => p.pessoa_id === pessoaId);
  if (!pessoa) return;
  const detalhe = document.getElementById('pessoa-detalhe');
  detalhe.innerHTML = `
    <div class="section">
      <h2>Editar pessoa</h2>
      ${pessoaCamposHTML(pessoa)}
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
  const atualizada = lerPessoaForm();
  if (!atualizada.nome) {
    document.getElementById('ed-p-aviso').textContent = 'O nome é obrigatório.';
    return;
  }
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

function criarPessoaForm() {
  assocSel.empresas = { existentes: new Set(), novas: [] };
  const resultados = document.getElementById('pessoa-resultados');
  if (resultados) resultados.innerHTML = '';
  const input = document.getElementById('search-pessoa-board');
  if (input) input.value = '';
  const detalhe = document.getElementById('pessoa-detalhe');
  detalhe.innerHTML = `
    <div class="section">
      <h2>Nova pessoa</h2>
      ${pessoaCamposHTML({})}
      <span class="field-error-msg" id="ed-p-aviso"></span>
    </div>
    ${assocWidgetHTML('empresas', 'Associar empresas * (pelo menos uma)', 'Pesquisar empresa...')}
    <div class="form-actions">
      <button id="ed-p-cancelar" class="btn-secondary">Cancelar</button>
      <button id="ed-p-guardar" class="btn-primary">Criar pessoa</button>
    </div>
  `;
  wireAssocWidget('empresas');
  document.getElementById('ed-p-cancelar').addEventListener('click', () => { detalhe.innerHTML = ''; });
  document.getElementById('ed-p-guardar').addEventListener('click', guardarNovaPessoa);
}

async function guardarNovaPessoa() {
  const p = lerPessoaForm();
  if (!p.nome) {
    document.getElementById('ed-p-aviso').textContent = 'O nome é obrigatório.';
    return;
  }
  const existentes = [...assocSel.empresas.existentes];
  const novas = assocSel.empresas.novas;
  if (!existentes.length && !novas.length) {
    document.getElementById('ed-p-aviso').textContent = 'Associa pelo menos uma empresa.';
    return;
  }
  const detalhe = document.getElementById('pessoa-detalhe');
  detalhe.innerHTML = `<p class="empty">A criar...</p>`;
  try {
    const empresaIds = [...existentes];
    for (const n of novas) {
      const empresa_id = await SheetsAPI.createEmpresa(token, n.dados);
      dados.empresas.push({ empresa_id, ...n.dados });
      empresaIds.push(empresa_id);
    }
    const empresaPrincipal = empresaIds[0] || '';
    const pessoa_id = await SheetsAPI.createPessoa(token, { empresa_id: empresaPrincipal, ...p });
    dados.pessoas.push({ pessoa_id, empresa_id: empresaPrincipal, ...p });
    for (const eid of empresaIds) {
      try { await SheetsAPI.addPessoaEmpresa(token, pessoa_id, eid); dados.pessoaEmpresas.push({ pessoa_id, empresa_id: eid }); } catch (err) {}
    }
    renderEmpresasTab();
    renderListaTab();
    mostrarDetalhePessoa(pessoa_id);
  } catch (err) {
    detalhe.innerHTML = `<p class="empty">Erro ao criar: ${esc(err.message)}</p>`;
  }
}

// Pessoas que só pertencem a esta empresa (serão apagadas em cascata).
function pessoasOrfasDaEmpresa(empresaId) {
  const pessoaIds = new Set([
    ...dados.pessoaEmpresas.filter(pe => pe.empresa_id === empresaId).map(pe => pe.pessoa_id),
    ...dados.pessoas.filter(p => p.empresa_id === empresaId).map(p => p.pessoa_id)
  ]);
  const orfas = [];
  pessoaIds.forEach(pid => {
    const set = new Set(dados.pessoaEmpresas.filter(pe => pe.pessoa_id === pid).map(pe => pe.empresa_id));
    const p = dados.pessoas.find(x => x.pessoa_id === pid);
    if (p && p.empresa_id) set.add(p.empresa_id);
    if ([...set].every(e => e === empresaId)) orfas.push(pid);
  });
  return orfas;
}

function apagarEmpresaConfirm(empresaId) {
  const empresa = dados.empresas.find(e => e.empresa_id === empresaId);
  if (!empresa) return;

  const nCards = dados.cardAssoc.filter(a => a.empresa_id === empresaId).length;
  const nOrfas = pessoasOrfasDaEmpresa(empresaId).length;

  const extras = [];
  if (nCards) extras.push(`${nCards} associação(ões) de cards`);
  if (nOrfas) extras.push(`${nOrfas} pessoa(s) que só pertenciam a esta empresa`);

  const detalhe = document.getElementById('empresa-detalhe');
  detalhe.innerHTML = `
    <div class="section">
      <h3>Apagar empresa</h3>
      <p>Apagar <strong>${esc(empresa.nome)}</strong>? Esta ação é irreversível.</p>
      ${extras.length ? `<p class="hint">Também serão apagados: ${extras.join(' e ')}.</p>` : ''}
      <div class="form-actions">
        <button id="btn-cancelar-apagar" class="btn-secondary">Cancelar</button>
        <button id="btn-confirmar-apagar" class="btn-perigo">Apagar</button>
      </div>
    </div>
  `;
  document.getElementById('btn-cancelar-apagar').addEventListener('click', () => mostrarDetalheEmpresa(empresaId));
  document.getElementById('btn-confirmar-apagar').addEventListener('click', () => handleApagarEmpresa(empresaId));
}

async function handleApagarEmpresa(empresaId) {
  const detalhe = document.getElementById('empresa-detalhe');
  detalhe.innerHTML = `<p class="empty">A apagar...</p>`;
  try {
    const orfas = new Set(pessoasOrfasDaEmpresa(empresaId));
    await SheetsAPI.deleteEmpresa(token, empresaId);
    dados.empresas = dados.empresas.filter(e => e.empresa_id !== empresaId);
    dados.pessoas = dados.pessoas.filter(p => !orfas.has(p.pessoa_id));
    dados.pessoaEmpresas = dados.pessoaEmpresas.filter(pe => pe.empresa_id !== empresaId && !orfas.has(pe.pessoa_id));
    dados.cardAssoc = dados.cardAssoc.filter(a => a.empresa_id !== empresaId && !orfas.has(a.pessoa_id));
    renderEmpresasTab();
    renderListaTab();
  } catch (err) {
    detalhe.innerHTML = `<p class="empty">Erro ao apagar: ${esc(err.message)}</p>`;
  }
}

function apagarPessoaConfirm(pessoaId) {
  const pessoa = dados.pessoas.find(p => p.pessoa_id === pessoaId);
  if (!pessoa) return;
  const nome = `${pessoa.nome} ${pessoa.apelido || ''}`.trim();
  const nCards = dados.cardAssoc.filter(a => a.pessoa_id === pessoaId).length;

  const detalhe = document.getElementById('pessoa-detalhe');
  detalhe.innerHTML = `
    <div class="section">
      <h3>Apagar pessoa</h3>
      <p>Apagar <strong>${esc(nome)}</strong>? Esta ação é irreversível.</p>
      ${nCards ? `<p class="hint">Também serão apagadas ${nCards} associação(ões) de cards.</p>` : ''}
      <div class="form-actions">
        <button id="btn-cancelar-apagar-p" class="btn-secondary">Cancelar</button>
        <button id="btn-confirmar-apagar-p" class="btn-perigo">Apagar</button>
      </div>
    </div>
  `;
  document.getElementById('btn-cancelar-apagar-p').addEventListener('click', () => mostrarDetalhePessoa(pessoaId));
  document.getElementById('btn-confirmar-apagar-p').addEventListener('click', () => handleApagarPessoa(pessoaId));
}

async function handleApagarPessoa(pessoaId) {
  const detalhe = document.getElementById('pessoa-detalhe');
  detalhe.innerHTML = `<p class="empty">A apagar...</p>`;
  try {
    await SheetsAPI.deletePessoa(token, pessoaId);
    dados.pessoas = dados.pessoas.filter(p => p.pessoa_id !== pessoaId);
    dados.pessoaEmpresas = dados.pessoaEmpresas.filter(pe => pe.pessoa_id !== pessoaId);
    dados.cardAssoc = dados.cardAssoc.filter(a => a.pessoa_id !== pessoaId);
    renderPessoasTab();
    renderListaTab();
  } catch (err) {
    detalhe.innerHTML = `<p class="empty">Erro ao apagar: ${esc(err.message)}</p>`;
  }
}

// ---- SEPARADOR LISTA (filtros + exportar) ----

function renderListaTab() {
  const panel = document.getElementById('tab-lista');
  const distritos = [...new Set(dados.empresas.map(e => e.distrito).filter(Boolean))].sort();

  panel.innerHTML = `
    <div class="filtros">
      <div class="filtro-grupo">
        <label>Pesquisar</label>
        <input type="text" id="f-texto" placeholder="Nome, email, empresa..." autocomplete="off" />
      </div>
      <div class="filtro-grupo">
        <label>Setor</label>
        <select id="f-setor">
          <option value="">Todos</option>
          <option value="Restaurante">Restaurante</option>
          <option value="Outro">Outro</option>
        </select>
      </div>
      <div class="filtro-grupo">
        <label>Cargo</label>
        <select id="f-cargo">
          <option value="">Todos</option>
          <option value="Gerência">Gerência</option>
          <option value="Colaborador">Colaborador</option>
        </select>
      </div>
      <div class="filtro-grupo">
        <label>Distrito</label>
        <select id="f-distrito">
          <option value="">Todos</option>
          ${distritos.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('')}
        </select>
      </div>
      <div class="filtro-grupo filtro-datas">
        <label>Data de criação</label>
        <div class="intervalo-datas">
          <input type="date" id="f-data-de" title="De" />
          <span>–</span>
          <input type="date" id="f-data-ate" title="Até" />
        </div>
      </div>
    </div>
    <div class="lista-acoes">
      <span id="lista-contagem" class="hint"></span>
      <button id="btn-exportar" class="btn-secondary btn-exportar">⬇️ Exportar CSV</button>
    </div>
    <div id="lista-tabela"></div>
  `;

  ['f-setor', 'f-cargo', 'f-distrito', 'f-data-de', 'f-data-ate'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderListaTabela);
  });
  document.getElementById('f-texto').addEventListener('input', renderListaTabela);
  document.getElementById('btn-exportar').addEventListener('click', exportarListaCSV);

  renderListaTabela();
}

function dataCriacaoDaPessoaId(pessoaId) {
  const m = /^PES_(\d+)$/.exec(pessoaId || '');
  if (!m) return null;
  const ms = parseInt(m[1], 10);
  return isNaN(ms) ? null : new Date(ms);
}

function contactosComEmpresa() {
  return dados.pessoas.map(p => {
    const empresa = dados.empresas.find(e => e.empresa_id === p.empresa_id) || null;
    return {
      pessoa: p,
      nome: `${p.nome} ${p.apelido || ''}`.trim(),
      cargo: p.cargo || '',
      funcao: p.funcao || '',
      email: p.email || '',
      telemovel: p.telemovel || '',
      empresaNome: empresa ? empresa.nome : '',
      distrito: empresa ? (empresa.distrito || '') : '',
      localidade: empresa ? (empresa.localizacao || '') : '',
      setor: empresa ? (empresa.setor || '') : '',
      criadoEm: dataCriacaoDaPessoaId(p.pessoa_id)
    };
  });
}

function filtrarContactos() {
  const q = val('f-texto').toLowerCase().trim();
  const setor = val('f-setor');
  const cargo = val('f-cargo');
  const distrito = val('f-distrito');
  const dataDe = val('f-data-de');
  const dataAte = val('f-data-ate');
  const deTs = dataDe ? new Date(dataDe + 'T00:00:00').getTime() : null;
  const ateTs = dataAte ? new Date(dataAte + 'T23:59:59').getTime() : null;

  return contactosComEmpresa().filter(c => {
    if (q && !`${c.nome} ${c.email} ${c.empresaNome}`.toLowerCase().includes(q)) return false;
    if (setor && c.setor !== setor) return false;
    if (cargo && c.cargo !== cargo) return false;
    if (distrito && c.distrito !== distrito) return false;
    if (deTs && (!c.criadoEm || c.criadoEm.getTime() < deTs)) return false;
    if (ateTs && (!c.criadoEm || c.criadoEm.getTime() > ateTs)) return false;
    return true;
  });
}

function renderListaTabela() {
  const lista = filtrarContactos();
  document.getElementById('lista-contagem').textContent = `${lista.length} contacto(s)`;
  const tabela = document.getElementById('lista-tabela');
  if (!lista.length) {
    tabela.innerHTML = `<p class="empty">Nenhum contacto com estes filtros.</p>`;
    return;
  }
  tabela.innerHTML = `
    <table class="crm-tabela">
      <thead>
        <tr>
          <th>Nome</th><th>Cargo</th><th>Empresa</th><th>Distrito</th><th>Setor</th><th>Email</th><th>Telemóvel</th><th>Criado</th>
        </tr>
      </thead>
      <tbody>
        ${lista.map(c => `
          <tr class="crm-linha" data-pessoa-id="${esc(c.pessoa.pessoa_id)}">
            <td>${esc(c.nome)}</td>
            <td>${esc(c.cargo) || '—'}</td>
            <td>${esc(c.empresaNome) || '—'}</td>
            <td>${esc(c.distrito) || '—'}</td>
            <td>${esc(c.setor) || '—'}</td>
            <td>${esc(c.email) || '—'}</td>
            <td>${esc(c.telemovel) || '—'}</td>
            <td>${c.criadoEm ? c.criadoEm.toLocaleDateString('pt-PT') : '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  tabela.querySelectorAll('.crm-linha').forEach(tr => {
    tr.addEventListener('click', () => abrirContactoNaAbaPessoas(tr.dataset.pessoaId));
  });
}

function abrirContactoNaAbaPessoas(pessoaId) {
  const pessoa = dados.pessoas.find(p => p.pessoa_id === pessoaId);
  const tabPessoas = document.querySelector('.tab[data-tab="pessoas"]');
  if (tabPessoas) tabPessoas.click();
  const input = document.getElementById('search-pessoa-board');
  if (input && pessoa) input.value = `${pessoa.nome} ${pessoa.apelido || ''}`.trim();
  const resultados = document.getElementById('pessoa-resultados');
  if (resultados) resultados.innerHTML = '';
  mostrarDetalhePessoa(pessoaId);
}

function csvCampo(v) {
  const s = String(v == null ? '' : v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function exportarListaCSV() {
  const lista = filtrarContactos();
  const cabecalho = ['Nome', 'Apelido', 'Cargo', 'Função', 'Email', 'Telemóvel', 'Empresa', 'Distrito', 'Localidade', 'Setor', 'Criado em'];
  const linhas = lista.map(c => [
    c.pessoa.nome || '', c.pessoa.apelido || '', c.cargo, c.funcao, c.email, c.telemovel,
    c.empresaNome, c.distrito, c.localidade, c.setor, c.criadoEm ? c.criadoEm.toISOString().slice(0, 10) : ''
  ]);
  const csv = [cabecalho, ...linhas].map(r => r.map(csvCampo).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `crm-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- SEPARADOR ARD (avenças) ----

async function renderArdTab() {
  if (avencas !== null) return; // já carregado (lazy)
  const panel = document.getElementById('tab-ard');
  panel.innerHTML = `<p class="empty">A carregar avenças...</p>`;
  try {
    avencas = await SheetsAPI.getAllAvencas(token);
  } catch (err) {
    panel.innerHTML = `<p class="empty">Erro ao carregar avenças: ${esc(err.message)}</p>`;
    return;
  }
  panel.innerHTML = `
    <div class="filtros">
      <div class="filtro-grupo">
        <label>Estado</label>
        <select id="f-av-estado">
          <option value="">Todos</option>
          <option value="ativa">Ativa</option>
          <option value="inativa">Inativa</option>
        </select>
      </div>
      <div class="filtro-grupo">
        <label>Tipo</label>
        <select id="f-av-tipo">
          <option value="">Todos</option>
          <option value="ARD">ARD</option>
          <option value="ARD Pro">ARD Pro</option>
          <option value="ARD Premium">ARD Premium</option>
          <option value="ARD (Antigo)">ARD (Antigo)</option>
          <option value="ARD Pro (Antigo)">ARD Pro (Antigo)</option>
          <option value="Fora">Fora</option>
        </select>
      </div>
    </div>
    <div class="lista-acoes">
      <span id="av-contagem" class="hint"></span>
      <button id="btn-nova-avenca" class="btn-primary btn-novo">+ Nova avença</button>
    </div>
    <div id="av-tabela"></div>
    <div id="av-detalhe"></div>
  `;
  document.getElementById('f-av-estado').addEventListener('change', renderArdTabela);
  document.getElementById('f-av-tipo').addEventListener('change', renderArdTabela);
  document.getElementById('btn-nova-avenca').addEventListener('click', criarAvencaForm);
  renderArdTabela();
}

// Só os tipos que renovam têm DATA_FIM e entram no cálculo do destaque.
const AV_TIPOS_RENOVAM = ['ARD', 'ARD Pro', 'ARD Premium'];

// Avença ativa (de tipo que renova) cujo fim cai nos próximos 30 dias.
function avExpiraEm30Dias(a) {
  if (a.estado !== 'ativa' || !AV_TIPOS_RENOVAM.includes(a.tipo) || !a.data_fim) return false;
  const fim = new Date(a.data_fim + 'T23:59:59');
  if (isNaN(fim.getTime())) return false;
  const dias = (fim.getTime() - Date.now()) / 86400000;
  return dias >= 0 && dias <= 30;
}

function renderArdTabela() {
  const estado = val('f-av-estado');
  const tipo = val('f-av-tipo');
  const lista = (avencas || []).filter(a => {
    if (estado && a.estado !== estado) return false;
    if (tipo && a.tipo !== tipo) return false;
    return true;
  });
  document.getElementById('av-contagem').textContent = `${lista.length} avença(s)`;
  const tabela = document.getElementById('av-tabela');
  if (!lista.length) {
    tabela.innerHTML = `<p class="empty">Nenhuma avença com estes filtros.</p>`;
    return;
  }
  tabela.innerHTML = `
    <div class="tabela-scroll">
      <table class="crm-tabela">
        <thead><tr>
          <th>Empresa</th><th>Tipo</th><th>Valor</th><th>Início</th><th>Fim</th><th>Renova</th><th>Estado</th>
        </tr></thead>
        <tbody>
          ${lista.map(avLinhaHTML).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function avLinhaHTML(a) {
  const empresa = dados.empresas.find(e => e.empresa_id === a.empresa_id);
  const empresaNome = empresa ? empresa.nome : (a.empresa_id || '—');
  const proximo = avExpiraEm30Dias(a);
  const fimCell = a.data_fim
    ? `<strong class="${proximo ? 'av-fim-proximo' : ''}">${esc(a.data_fim)}${proximo ? ' ⚠' : ''}</strong>`
    : '—';
  return `
    <tr class="${proximo ? 'av-linha-proxima' : ''}">
      <td>${esc(empresaNome)}</td>
      <td>${esc(a.tipo) || '—'}</td>
      <td>${a.valor ? esc(a.valor) + ' €' : '—'}</td>
      <td>${esc(a.data_inicio) || '—'}</td>
      <td>${fimCell}</td>
      <td>${esc(a.renova) || '—'}</td>
      <td><span class="card-estado ${a.estado === 'ativa' ? 'ativo' : 'arquivado'}">${esc(a.estado) || '—'}</span></td>
    </tr>
  `;
}

function avTipoOptionsHTML(selecionado) {
  const tipos = ['ARD', 'ARD Pro', 'ARD Premium', 'ARD (Antigo)', 'ARD Pro (Antigo)', 'Fora'];
  return tipos.map(tp => `<option value="${tp}"${tp === selecionado ? ' selected' : ''}>${tp}</option>`).join('');
}

function criarAvencaForm() {
  avEmpresaSel = null;
  const det = document.getElementById('av-detalhe');
  det.innerHTML = `
    <div class="section">
      <h2>Nova avença</h2>
      <div class="form-group">
        <label>Empresa *</label>
        <div id="av-empresa-escolhida"></div>
        <div id="av-empresa-pesquisa">
          <input type="text" id="av-empresa-search" placeholder="Pesquisar empresa..." autocomplete="off" />
          <div id="av-empresa-res" class="resultados"></div>
          <button type="button" id="av-criar-empresa" class="btn-secondary" style="margin-top:6px;">+ Criar empresa</button>
          <div id="av-empresa-novaform"></div>
        </div>
      </div>
      <div class="form-group" id="av-pessoa-sec" style="display:none;">
        <label>Contacto da empresa (opcional)</label>
        <div id="av-pessoa-feitos"></div>
        <button type="button" id="av-criar-pessoa" class="btn-secondary" style="margin-top:6px;">+ Criar pessoa para esta empresa</button>
        <div id="av-pessoa-novaform"></div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label>Tipo *</label>
          <select id="av-tipo">
            <option value="">— Selecionar —</option>
            ${avTipoOptionsHTML('')}
          </select>
        </div>
        <div class="form-group"><label>Valor (€)</label><input type="number" id="av-valor" step="0.01" min="0" /></div>
        <div class="form-group"><label>Data de início</label><input type="date" id="av-data-inicio" /></div>
        <div class="form-group" id="av-grupo-fim"><label>Data de fim *</label><input type="date" id="av-data-fim" /></div>
      </div>
      <div class="form-group"><label>Notas</label><textarea id="av-notas"></textarea></div>
      <div class="info-row"><span class="label">Renova</span><span id="av-renova-info">—</span></div>
      <span class="field-error-msg" id="av-aviso"></span>
      <div class="form-actions">
        <button id="av-cancelar" class="btn-secondary">Cancelar</button>
        <button id="av-guardar" class="btn-primary">Criar avença</button>
      </div>
    </div>
  `;
  wireAvEmpresaPicker();
  document.getElementById('av-criar-pessoa').addEventListener('click', avAbrirCriarPessoa);
  document.getElementById('av-tipo').addEventListener('change', avAtualizaPorTipo);
  document.getElementById('av-cancelar').addEventListener('click', () => { det.innerHTML = ''; });
  document.getElementById('av-guardar').addEventListener('click', guardarNovaAvenca);
  avAtualizaPorTipo();
  det.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Ajusta o formulário ao tipo: só os que renovam têm DATA_FIM (obrigatória) e RENOVA=SIM.
function avAtualizaPorTipo() {
  const renova = AV_TIPOS_RENOVAM.includes(val('av-tipo'));
  document.getElementById('av-grupo-fim').style.display = renova ? '' : 'none';
  if (!renova) document.getElementById('av-data-fim').value = '';
  document.getElementById('av-renova-info').textContent = renova ? 'SIM' : 'NÃO';
}

function wireAvEmpresaPicker() {
  const input = document.getElementById('av-empresa-search');
  const res = document.getElementById('av-empresa-res');
  input.addEventListener('input', function() {
    const q = this.value.toLowerCase().trim();
    if (!q) { res.innerHTML = ''; return; }
    const filtradas = dados.empresas.filter(e => (e.nome || '').toLowerCase().includes(q)).slice(0, 8);
    res.innerHTML = filtradas.length
      ? filtradas.map(e => `<div class="resultado-item" data-id="${esc(e.empresa_id)}"><strong>${esc(e.nome)}</strong>${e.distrito ? `<span>${esc(e.distrito)}</span>` : ''}</div>`).join('')
      : `<p class="empty">Nenhuma empresa encontrada. Cria abaixo.</p>`;
    res.querySelectorAll('.resultado-item').forEach(el => {
      el.addEventListener('click', () => avEscolherEmpresa(el.dataset.id));
    });
  });
  document.getElementById('av-criar-empresa').addEventListener('click', avAbrirCriarEmpresa);
  renderAvEmpresaEscolhida();
}

function avEscolherEmpresa(id) {
  const emp = dados.empresas.find(e => e.empresa_id === id);
  avEmpresaSel = emp ? { id: emp.empresa_id, nome: emp.nome } : null;
  const s = document.getElementById('av-empresa-search'); if (s) s.value = '';
  const r = document.getElementById('av-empresa-res'); if (r) r.innerHTML = '';
  renderAvEmpresaEscolhida();
}

function renderAvEmpresaEscolhida() {
  const cont = document.getElementById('av-empresa-escolhida');
  if (!cont) return;
  const pesquisa = document.getElementById('av-empresa-pesquisa');
  const pessoaSec = document.getElementById('av-pessoa-sec');
  if (avEmpresaSel) {
    cont.innerHTML = `<div class="resultado-item selecionado assoc-chip"><strong>${esc(avEmpresaSel.nome)}</strong><span class="assoc-remover" title="Trocar empresa">✕</span></div>`;
    cont.querySelector('.assoc-remover').addEventListener('click', () => { avEmpresaSel = null; renderAvEmpresaEscolhida(); });
    if (pesquisa) pesquisa.style.display = 'none';
    if (pessoaSec) pessoaSec.style.display = '';
  } else {
    cont.innerHTML = '';
    if (pesquisa) pesquisa.style.display = '';
    if (pessoaSec) pessoaSec.style.display = 'none';
    const feitos = document.getElementById('av-pessoa-feitos'); if (feitos) feitos.innerHTML = '';
    const novaform = document.getElementById('av-empresa-novaform'); if (novaform) novaform.innerHTML = '';
    const btnCriar = document.getElementById('av-criar-empresa'); if (btnCriar) btnCriar.style.display = '';
  }
}

// Criação inline de empresa (reutiliza o formulário de empresa existente).
function avAbrirCriarEmpresa() {
  const cont = document.getElementById('av-empresa-novaform');
  const prefill = (document.getElementById('av-empresa-search') || { value: '' }).value.trim();
  cont.innerHTML = `
    <div class="assoc-nova-box">
      <h4>Nova empresa</h4>
      ${empresaCamposHTML({})}
      <span class="field-error-msg" id="av-emp-aviso"></span>
      <div class="form-actions">
        <button type="button" id="av-emp-cancelar" class="btn-secondary">Cancelar</button>
        <button type="button" id="av-emp-criar" class="btn-primary">Criar empresa</button>
      </div>
    </div>
  `;
  wireEmpresaCampos();
  if (prefill) { const n = document.getElementById('ed-nome'); if (n) n.value = prefill; }
  document.getElementById('av-criar-empresa').style.display = 'none';
  document.getElementById('av-emp-cancelar').addEventListener('click', avFecharCriarEmpresa);
  document.getElementById('av-emp-criar').addEventListener('click', avGuardarNovaEmpresaInline);
}

function avFecharCriarEmpresa() {
  document.getElementById('av-empresa-novaform').innerHTML = '';
  const btn = document.getElementById('av-criar-empresa');
  if (btn) btn.style.display = '';
}

async function avGuardarNovaEmpresaInline() {
  const e = lerEmpresaForm();
  if (!e.nome || !e.distrito || !e.setor) {
    document.getElementById('av-emp-aviso').textContent = 'Nome, distrito e setor são obrigatórios.';
    return;
  }
  const btn = document.getElementById('av-emp-criar');
  if (btn) { btn.disabled = true; btn.textContent = 'A criar...'; }
  try {
    const empresa_id = await SheetsAPI.createEmpresa(token, e);
    dados.empresas.push({ empresa_id, ...e });
    avFecharCriarEmpresa();
    avEmpresaSel = { id: empresa_id, nome: e.nome };
    renderAvEmpresaEscolhida();
  } catch (err) {
    document.getElementById('av-emp-aviso').textContent = 'Erro: ' + err.message;
    if (btn) { btn.disabled = false; btn.textContent = 'Criar empresa'; }
  }
}

// Criação inline de pessoa ligada à empresa da avença (conveniência; não toca na avença).
function avAbrirCriarPessoa() {
  if (!avEmpresaSel) return;
  const cont = document.getElementById('av-pessoa-novaform');
  cont.innerHTML = `
    <div class="assoc-nova-box">
      <h4>Nova pessoa — ${esc(avEmpresaSel.nome)}</h4>
      ${pessoaCamposHTML({})}
      <span class="field-error-msg" id="av-pes-aviso"></span>
      <div class="form-actions">
        <button type="button" id="av-pes-cancelar" class="btn-secondary">Cancelar</button>
        <button type="button" id="av-pes-criar" class="btn-primary">Criar pessoa</button>
      </div>
    </div>
  `;
  document.getElementById('av-criar-pessoa').style.display = 'none';
  document.getElementById('av-pes-cancelar').addEventListener('click', avFecharCriarPessoa);
  document.getElementById('av-pes-criar').addEventListener('click', avGuardarNovaPessoaInline);
}

function avFecharCriarPessoa() {
  document.getElementById('av-pessoa-novaform').innerHTML = '';
  const btn = document.getElementById('av-criar-pessoa');
  if (btn) btn.style.display = '';
}

async function avGuardarNovaPessoaInline() {
  if (!avEmpresaSel) return;
  const p = lerPessoaForm();
  if (!p.nome) { document.getElementById('av-pes-aviso').textContent = 'O nome é obrigatório.'; return; }
  const empresa_id = avEmpresaSel.id;
  const btn = document.getElementById('av-pes-criar');
  if (btn) { btn.disabled = true; btn.textContent = 'A criar...'; }
  try {
    const pessoa_id = await SheetsAPI.createPessoa(token, { empresa_id, ...p });
    dados.pessoas.push({ pessoa_id, empresa_id, ...p });
    try { await SheetsAPI.addPessoaEmpresa(token, pessoa_id, empresa_id); dados.pessoaEmpresas.push({ pessoa_id, empresa_id }); } catch (e) {}
    avFecharCriarPessoa();
    const nome = `${p.nome} ${p.apelido || ''}`.trim();
    document.getElementById('av-pessoa-feitos').innerHTML += `<div class="hint">✓ Contacto criado: ${esc(nome)}</div>`;
  } catch (err) {
    document.getElementById('av-pes-aviso').textContent = 'Erro: ' + err.message;
    if (btn) { btn.disabled = false; btn.textContent = 'Criar pessoa'; }
  }
}

async function guardarNovaAvenca() {
  const aviso = document.getElementById('av-aviso');
  aviso.textContent = '';
  const tipo = val('av-tipo');
  if (!avEmpresaSel) { aviso.textContent = 'Escolhe uma empresa.'; return; }
  if (!tipo) { aviso.textContent = 'Escolhe o tipo.'; return; }
  const renova = AV_TIPOS_RENOVAM.includes(tipo);
  const data_fim = renova ? val('av-data-fim') : '';
  if (renova && !data_fim) { aviso.textContent = 'Data de fim obrigatória para este tipo.'; return; }

  const avenca = {
    empresa_id: avEmpresaSel.id,
    tipo,
    valor: val('av-valor').trim(),
    data_inicio: val('av-data-inicio'),
    data_fim,
    renova: renova ? 'SIM' : 'NÃO',
    estado: 'ativa',
    notas: val('av-notas').trim()
  };

  const det = document.getElementById('av-detalhe');
  det.innerHTML = `<p class="empty">A criar...</p>`;
  try {
    const avenca_id = await SheetsAPI.addAvenca(token, avenca);
    avencas.push({ avenca_id, ...avenca });
    det.innerHTML = '';
    renderArdTabela();
  } catch (err) {
    det.innerHTML = `<p class="empty">Erro ao criar: ${esc(err.message)}</p>`;
  }
}

// ---- SEPARADOR IMPORTAR ----

function renderImportarTab() {
  const panel = document.getElementById('tab-importar');
  panel.innerHTML = `
    <div class="section">
      <h2>Importar contactos</h2>
      <p class="hint">Carrega um CSV ou cola os dados. Colunas: Nome, Apelido, Cargo, Função, Email, Telemóvel, Empresa, Distrito, Localidade, Setor, Cor. A 1ª linha é o cabeçalho. Só "Nome" é obrigatório.</p>
      <div class="form-group">
        <label>Ficheiro CSV</label>
        <input type="file" id="imp-ficheiro" accept=".csv,text/csv" />
      </div>
      <div class="form-group">
        <label>...ou colar aqui</label>
        <textarea id="imp-texto" placeholder="Nome,Apelido,Cargo,Email,Empresa,Distrito,Localidade,Setor&#10;João,Silva,Gerência,joao@x.pt,Restaurante X,Lisboa,Lisboa,Restaurante"></textarea>
      </div>
      <div class="form-actions">
        <button id="imp-template" class="btn-secondary">⬇️ Modelo CSV</button>
        <button id="imp-processar" class="btn-primary">Processar</button>
      </div>
      <span class="field-error-msg" id="imp-aviso"></span>
      <div id="imp-staging"></div>
    </div>
  `;

  document.getElementById('imp-ficheiro').addEventListener('change', function() {
    const f = this.files && this.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      document.getElementById('imp-texto').value = reader.result;
      processarImport(reader.result);
    };
    reader.readAsText(f);
  });
  document.getElementById('imp-processar').addEventListener('click', () => {
    processarImport(document.getElementById('imp-texto').value);
  });
  document.getElementById('imp-template').addEventListener('click', () => {
    const csv = 'Nome,Apelido,Cargo,Função,Email,Telemóvel,Empresa,Distrito,Localidade,Setor,Cor\r\nJoão,Silva,Gerência,,joao@exemplo.pt,912345678,Restaurante X,Lisboa,Lisboa,Restaurante,blue';
    baixarCSV(csv, 'modelo-contactos.csv');
  });

  carregarImportStaging();
}

function normalizarCol(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// Telemóvel: ignora letras/pontuação e fica com os últimos 9 dígitos.
function limparTelemovel(s) {
  const digitos = String(s || '').replace(/\D/g, '');
  return digitos.length > 9 ? digitos.slice(-9) : digitos;
}

// Email: extrai o token com @ (ignora prefixos como "Work:").
function limparEmail(s) {
  const m = String(s || '').match(/[^\s,;:<>()"]+@[^\s,;:<>()"]+/);
  return m ? m[0].replace(/[.,;:]+$/, '') : '';
}

// Parser de CSV simples: deteta delimitador (, ou ;) e respeita aspas.
function parseCSV(texto) {
  const primeira = (texto || '').split(/\r?\n/)[0] || '';
  const delim = primeira.split(';').length > primeira.split(',').length ? ';' : ',';
  const linhas = [];
  let campo = '', linha = [], emAspas = false;
  const fimCampo = () => { linha.push(campo); campo = ''; };
  const fimLinha = () => { fimCampo(); linhas.push(linha); linha = []; };
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (emAspas) {
      if (ch === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; }
        else emAspas = false;
      } else campo += ch;
    } else if (ch === '"') emAspas = true;
    else if (ch === delim) fimCampo();
    else if (ch === '\n') fimLinha();
    else if (ch !== '\r') campo += ch;
  }
  if (campo.length || linha.length) fimLinha();
  return linhas.filter(l => l.some(c => c.trim() !== ''));
}

function processarImport(texto) {
  const aviso = document.getElementById('imp-aviso');
  aviso.textContent = '';
  const linhas = parseCSV(texto || '');
  if (linhas.length < 2) {
    aviso.textContent = 'CSV vazio ou sem dados (precisa de cabeçalho + pelo menos uma linha).';
    return;
  }

  const mapa = {
    nome: 'nome', apelido: 'apelido', cargo: 'cargo', funcao: 'funcao',
    email: 'email', 'e-mail': 'email', telemovel: 'telemovel', telefone: 'telemovel',
    empresa: 'empresa', distrito: 'distrito',
    localidade: 'localidade', cidade: 'localidade', localizacao: 'localidade',
    setor: 'setor', sector: 'setor', cor: 'cor'
  };
  const cab = linhas[0].map(normalizarCol);
  const idx = {};
  cab.forEach((h, c) => { if (mapa[h] && idx[mapa[h]] === undefined) idx[mapa[h]] = c; });
  if (idx.nome === undefined) {
    aviso.textContent = 'Não encontrei a coluna "Nome" no cabeçalho.';
    return;
  }

  const campos = ['nome', 'apelido', 'cargo', 'funcao', 'email', 'telemovel', 'empresa', 'distrito', 'localidade', 'setor', 'cor'];
  importLinhas = linhas.slice(1).map(cols => {
    const o = { estado: 'pendente' };
    campos.forEach(f => { o[f] = idx[f] !== undefined ? (cols[idx[f]] || '').trim() : ''; });
    o.telemovel = limparTelemovel(o.telemovel);
    o.email = limparEmail(o.email);
    o.cor = TRELLO_CORES.some(c => c.nome === o.cor) ? o.cor : 'blue';
    return o;
  }).filter(o => o.nome);

  if (!importLinhas.length) {
    aviso.textContent = 'Nenhuma linha com nome para importar.';
    return;
  }
  renderImportStaging();
}

function selectImportHTML(id, opts, val) {
  const todas = (val && !opts.includes(val)) ? [val, ...opts] : opts;
  return `<select id="${id}"><option value="">—</option>${
    todas.map(o => `<option value="${esc(o)}" ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')
  }</select>`;
}

function selectCorHTML(id, val) {
  const sel = val || 'blue';
  return `<select id="${id}">${
    TRELLO_CORES.map(c => `<option value="${c.nome}" ${c.nome === sel ? 'selected' : ''} style="background:${c.hex}">${c.nome}</option>`).join('')
  }</select>`;
}

// Lista de espera guardada no armazenamento do Power-Up (member/private),
// que sincroniza pela conta Trello entre browser, app e dispositivos.
// Dividida em blocos por causa do limite de ~4096 caracteres por chave.
const IMPORT_KEY = 'importStaging';
const IMPORT_CHUNK = 3000;

let _saveTimer = null;
function agendarGuardarStaging() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => { guardarImportStaging(); }, 400);
}

async function guardarImportStaging() {
  if (!t) return;
  try {
    const pendentes = importLinhas
      .filter(l => l.estado === 'pendente')
      .map(l => ({
        nome: l.nome, apelido: l.apelido, cargo: l.cargo, funcao: l.funcao,
        email: l.email, telemovel: l.telemovel, empresa: l.empresa,
        distrito: l.distrito, localidade: l.localidade, setor: l.setor, cor: l.cor
      }));
    const antigoN = (await t.get('member', 'private', IMPORT_KEY + '_n')) || 0;

    if (!pendentes.length) {
      for (let i = 0; i < antigoN; i++) await t.remove('member', 'private', IMPORT_KEY + '_' + i);
      await t.remove('member', 'private', IMPORT_KEY + '_n');
      return;
    }

    const json = JSON.stringify(pendentes);
    const blocos = [];
    for (let i = 0; i < json.length; i += IMPORT_CHUNK) blocos.push(json.slice(i, i + IMPORT_CHUNK));
    for (let i = 0; i < blocos.length; i++) await t.set('member', 'private', IMPORT_KEY + '_' + i, blocos[i]);
    for (let i = blocos.length; i < antigoN; i++) await t.remove('member', 'private', IMPORT_KEY + '_' + i);
    await t.set('member', 'private', IMPORT_KEY + '_n', blocos.length);
  } catch (e) {}
}

async function carregarImportStaging() {
  if (!t) return;
  try {
    const n = (await t.get('member', 'private', IMPORT_KEY + '_n')) || 0;
    if (!n) return;
    let json = '';
    for (let i = 0; i < n; i++) json += (await t.get('member', 'private', IMPORT_KEY + '_' + i)) || '';
    const arr = JSON.parse(json);
    if (Array.isArray(arr) && arr.length) {
      importLinhas = arr.map(o => ({ ...o, estado: 'pendente' }));
      renderImportStaging();
    }
  } catch (e) {}
}

function limparImportStaging() {
  importLinhas = [];
  renderImportStaging();
}

function renderImportStaging() {
  const cont = document.getElementById('imp-staging');
  if (!cont) return;
  if (!importLinhas.length) { cont.innerHTML = ''; agendarGuardarStaging(); return; }

  importLinhas.forEach(l => {
    if (l.estado === 'pendente') {
      l.duplicado = !!(l.email && dados.pessoas.some(p => (p.email || '').toLowerCase() === l.email.toLowerCase()));
    }
  });

  const nPend = importLinhas.filter(l => l.estado === 'pendente').length;
  const nOk = importLinhas.filter(l => l.estado === 'importado').length;

  cont.innerHTML = `
    <div class="lista-acoes" style="margin-top:16px;">
      <span class="hint">${nPend} pendente(s) · ${nOk} importado(s)</span>
      <span class="imp-bulk-acoes">
        <button id="imp-limpar" class="btn-link btn-danger">Limpar lista</button>
        <button id="imp-recusar-sel" class="btn-secondary" style="flex:0 0 auto;">Recusar selecionados</button>
        <button id="imp-aprovar-sel" class="btn-primary" style="flex:0 0 auto;">Aprovar selecionados</button>
      </span>
    </div>
    <div class="tabela-scroll">
      <table class="crm-tabela imp-tabela">
        <thead>
          <tr>
            <th><input type="checkbox" id="imp-check-todos" /></th>
            <th>Nome</th><th>Apelido</th><th>Cargo</th><th>Função</th><th>Email</th><th>Telemóvel</th><th>Empresa</th><th>Distrito</th><th>Localidade</th><th>Setor</th><th>Cor</th><th>Estado</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${importLinhas.map((l, i) => linhaImportHTML(l, i)).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('imp-check-todos').addEventListener('change', function() {
    importLinhas.forEach((l, i) => {
      if (l.estado !== 'pendente') return;
      const cb = document.getElementById('imp-check-' + i);
      if (cb) cb.checked = this.checked;
    });
  });
  document.getElementById('imp-aprovar-sel').addEventListener('click', aprovarSelecionados);
  document.getElementById('imp-recusar-sel').addEventListener('click', recusarSelecionados);
  document.getElementById('imp-limpar').addEventListener('click', limparImportStaging);
  importLinhas.forEach((l, i) => {
    if (l.estado !== 'pendente') return;
    const btnA = document.getElementById('imp-aprovar-' + i);
    const btnR = document.getElementById('imp-recusar-' + i);
    if (btnA) btnA.addEventListener('click', () => aprovarLinha(i));
    if (btnR) btnR.addEventListener('click', () => recusarLinha(i));
  });

  // Guarda as edições dos campos (ao sair de cada campo) na lista de espera.
  cont.addEventListener('change', () => { sincronizarPendentes(); agendarGuardarStaging(); });

  agendarGuardarStaging();
}

function linhaImportHTML(l, i) {
  if (l.estado === 'recusado') return '';
  if (l.estado === 'importado') {
    return `<tr class="imp-importado">
      <td>✓</td>
      <td>${esc(l.nome)}</td><td>${esc(l.apelido)}</td><td>${esc(l.cargo)}</td><td>${esc(l.funcao)}</td>
      <td>${esc(l.email)}</td><td>${esc(l.telemovel)}</td><td>${esc(l.empresa)}</td><td>${esc(l.distrito)}</td><td>${esc(l.localidade)}</td><td>${esc(l.setor)}</td>
      <td><span class="tag-dot" style="background:${hexDaCor(l.cor)}"></span>${esc(l.cor)}</td>
      <td><span class="imp-estado-ok">Importado</span></td><td></td>
    </tr>`;
  }
  const estado = l.erro
    ? `<span class="imp-estado-erro">${esc(l.erro)}</span>`
    : (l.duplicado ? '<span class="imp-estado-dup">Já existe</span>' : '<span class="hint">Pendente</span>');
  return `<tr class="${l.duplicado ? 'imp-dup' : ''}">
    <td><input type="checkbox" id="imp-check-${i}" ${l.duplicado ? '' : 'checked'} /></td>
    <td><input type="text" id="imp-${i}-nome" value="${esc(l.nome)}" /></td>
    <td><input type="text" id="imp-${i}-apelido" value="${esc(l.apelido)}" /></td>
    <td>${selectImportHTML('imp-' + i + '-cargo', ['Gerência', 'Colaborador'], l.cargo)}</td>
    <td><input type="text" id="imp-${i}-funcao" value="${esc(l.funcao)}" /></td>
    <td><input type="text" id="imp-${i}-email" value="${esc(l.email)}" /></td>
    <td><input type="text" id="imp-${i}-telemovel" value="${esc(l.telemovel)}" /></td>
    <td><input type="text" id="imp-${i}-empresa" value="${esc(l.empresa)}" /></td>
    <td><select id="imp-${i}-distrito"><option value="">—</option>${distritoOptionsHTML(l.distrito)}</select></td>
    <td><input type="text" id="imp-${i}-localidade" value="${esc(l.localidade)}" /></td>
    <td>${selectImportHTML('imp-' + i + '-setor', ['Restaurante', 'Outro'], l.setor)}</td>
    <td>${selectCorHTML('imp-' + i + '-cor', l.cor)}</td>
    <td>${estado}</td>
    <td class="imp-acoes">
      <button class="btn-icon" id="imp-aprovar-${i}" title="Aprovar">✓</button>
      <button class="btn-icon btn-danger" id="imp-recusar-${i}" title="Recusar">✕</button>
    </td>
  </tr>`;
}

function sincronizarPendentes() {
  importLinhas.forEach((l, i) => {
    if (l.estado !== 'pendente') return;
    ['nome', 'apelido', 'cargo', 'funcao', 'email', 'telemovel', 'empresa', 'distrito', 'localidade', 'setor', 'cor'].forEach(c => {
      const el = document.getElementById(`imp-${i}-${c}`);
      if (el) l[c] = el.value.trim();
    });
  });
}

async function importarUmaLinha(i) {
  const l = importLinhas[i];
  if (!l || l.estado !== 'pendente') return;
  if (!l.nome) { l.erro = 'Falta o nome'; return; }
  l.erro = null;
  try {
    let empresa_id = '';
    if (l.empresa) {
      const existente = dados.empresas.find(e => (e.nome || '').toLowerCase() === l.empresa.toLowerCase());
      if (existente) {
        empresa_id = existente.empresa_id;
      } else {
        const cor = l.cor || 'blue';
        empresa_id = await SheetsAPI.createEmpresa(token, {
          nome: l.empresa, distrito: l.distrito, localizacao: l.localidade, setor: l.setor || 'Outro',
          plano: '', data_inicio: '', email: '', telefone: '', notas: '', cor
        });
        dados.empresas.push({ empresa_id, nome: l.empresa, distrito: l.distrito, localizacao: l.localidade, setor: l.setor || 'Outro', cor });
      }
    }
    const pessoa_id = await SheetsAPI.createPessoa(token, {
      empresa_id, nome: l.nome, apelido: l.apelido, cargo: l.cargo,
      funcao: l.funcao, email: l.email, telemovel: l.telemovel
    });
    dados.pessoas.push({ pessoa_id, empresa_id, nome: l.nome, apelido: l.apelido, cargo: l.cargo, funcao: l.funcao, email: l.email, telemovel: l.telemovel });
    if (empresa_id) {
      try { await SheetsAPI.addPessoaEmpresa(token, pessoa_id, empresa_id); dados.pessoaEmpresas.push({ pessoa_id, empresa_id }); } catch (e) {}
    }
    l.estado = 'importado';
  } catch (err) {
    l.erro = err.message;
  }
}

async function aprovarLinha(i) {
  sincronizarPendentes();
  await importarUmaLinha(i);
  renderImportStaging();
  renderListaTab();
}

async function aprovarSelecionados() {
  sincronizarPendentes();
  const idxs = [];
  importLinhas.forEach((l, i) => {
    const cb = document.getElementById('imp-check-' + i);
    if (l.estado === 'pendente' && cb && cb.checked) idxs.push(i);
  });
  if (!idxs.length) return;
  const btn = document.getElementById('imp-aprovar-sel');
  if (btn) { btn.disabled = true; btn.textContent = 'A importar...'; }
  for (const i of idxs) await importarUmaLinha(i);
  renderImportStaging();
  renderListaTab();
}

function recusarLinha(i) {
  sincronizarPendentes();
  importLinhas[i].estado = 'recusado';
  renderImportStaging();
}

function recusarSelecionados() {
  sincronizarPendentes();
  let algum = false;
  importLinhas.forEach((l, i) => {
    const cb = document.getElementById('imp-check-' + i);
    if (l.estado === 'pendente' && cb && cb.checked) { l.estado = 'recusado'; algum = true; }
  });
  if (algum) renderImportStaging();
}

function baixarCSV(csv, nome) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  const btnApagar = document.getElementById('btn-apagar-empresa');
  if (btnApagar) btnApagar.addEventListener('click', () => apagarEmpresaConfirm(empresaId));

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
    campoHTML('Distrito', esc(empresa.distrito) || '—'),
    campoHTML('Setor', esc(empresa.setor) || '—')
  ];
  if (empresa.localizacao) campos.push(campoHTML('Localidade', esc(empresa.localizacao)));
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
        <span class="header-actions">
          <button class="btn-link" id="btn-editar-empresa" title="Editar empresa">✏️ Editar</button>
          <button class="btn-link btn-danger" id="btn-apagar-empresa" title="Apagar empresa">🗑️ Apagar</button>
        </span>
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

// ---- WIDGET DE ASSOCIAÇÃO MÚLTIPLA (com criação inline) ----
const assocSel = {
  pessoas: { existentes: new Set(), novas: [] },
  empresas: { existentes: new Set(), novas: [] }
};

function assocItemsPessoas() {
  return dados.pessoas.map(p => ({ id: p.pessoa_id, label: `${p.nome} ${p.apelido || ''}`.trim(), sub: p.cargo || '' }));
}
function assocItemsEmpresas() {
  return dados.empresas.map(e => ({ id: e.empresa_id, label: e.nome, sub: e.distrito || '' }));
}

const assocConfig = {
  pessoas: {
    singular: 'pessoa',
    items: assocItemsPessoas,
    nomeId: 'ed-p-nome',
    miniForm: () => pessoaCamposHTML({}),
    wireMini: () => {},
    ler: () => lerPessoaForm(),
    validar: d => d.nome ? null : 'O nome é obrigatório.',
    label: d => `${d.nome} ${d.apelido || ''}`.trim()
  },
  empresas: {
    singular: 'empresa',
    items: assocItemsEmpresas,
    nomeId: 'ed-nome',
    miniForm: () => empresaCamposHTML({}),
    wireMini: () => wireEmpresaCampos(),
    ler: () => lerEmpresaForm(),
    validar: d => (d.nome && d.distrito && d.setor) ? null : 'Nome, distrito e setor são obrigatórios.',
    label: d => d.nome
  }
};

function assocWidgetHTML(tipo, titulo, placeholder) {
  const cfg = assocConfig[tipo];
  return `
    <div class="section">
      <h3>${titulo}</h3>
      <div class="search-box"><input type="text" id="assoc-search-${tipo}" placeholder="${placeholder}" autocomplete="off" /></div>
      <div id="assoc-res-${tipo}" class="resultados"></div>
      <button type="button" id="assoc-criar-${tipo}" class="btn-secondary" style="margin-top:6px;">+ Criar nova ${cfg.singular}</button>
      <div id="assoc-novaform-${tipo}"></div>
      <div id="assoc-sel-${tipo}" class="pessoas-grid" style="margin-top:8px;"></div>
    </div>
  `;
}

function wireAssocWidget(tipo) {
  const cfg = assocConfig[tipo];
  const input = document.getElementById('assoc-search-' + tipo);
  const res = document.getElementById('assoc-res-' + tipo);
  input.addEventListener('input', function() {
    const q = this.value.toLowerCase().trim();
    if (!q) { res.innerHTML = ''; return; }
    const sel = assocSel[tipo].existentes;
    const filtrados = cfg.items().filter(it => !sel.has(it.id) && it.label.toLowerCase().includes(q)).slice(0, 8);
    res.innerHTML = filtrados.length
      ? filtrados.map(it => `<div class="resultado-item" data-id="${esc(it.id)}"><strong>${esc(it.label)}</strong>${it.sub ? `<span>${esc(it.sub)}</span>` : ''}</div>`).join('')
      : `<p class="empty">Nada encontrado. Cria nova abaixo.</p>`;
    res.querySelectorAll('.resultado-item').forEach(el => {
      el.addEventListener('click', () => {
        sel.add(el.dataset.id);
        input.value = '';
        res.innerHTML = '';
        renderAssocSel(tipo);
      });
    });
  });
  document.getElementById('assoc-criar-' + tipo).addEventListener('click', () => abrirNovaInline(tipo));
  renderAssocSel(tipo);
}

function abrirNovaInline(tipo) {
  const cfg = assocConfig[tipo];
  const cont = document.getElementById('assoc-novaform-' + tipo);
  const prefill = (document.getElementById('assoc-search-' + tipo) || { value: '' }).value.trim();
  cont.innerHTML = `
    <div class="assoc-nova-box">
      <h4>Nova ${cfg.singular}</h4>
      ${cfg.miniForm()}
      <span class="field-error-msg" id="assoc-nova-aviso-${tipo}"></span>
      <div class="form-actions">
        <button type="button" id="assoc-nova-cancelar-${tipo}" class="btn-secondary">Cancelar</button>
        <button type="button" id="assoc-nova-add-${tipo}" class="btn-primary">Adicionar</button>
      </div>
    </div>
  `;
  cfg.wireMini();
  if (prefill) { const n = document.getElementById(cfg.nomeId); if (n) n.value = prefill; }
  document.getElementById('assoc-criar-' + tipo).style.display = 'none';
  document.getElementById('assoc-nova-cancelar-' + tipo).addEventListener('click', () => fecharNovaInline(tipo));
  document.getElementById('assoc-nova-add-' + tipo).addEventListener('click', () => adicionarNovaInline(tipo));
}

function fecharNovaInline(tipo) {
  document.getElementById('assoc-novaform-' + tipo).innerHTML = '';
  const btn = document.getElementById('assoc-criar-' + tipo);
  if (btn) btn.style.display = '';
}

function adicionarNovaInline(tipo) {
  const cfg = assocConfig[tipo];
  const dadosNova = cfg.ler();
  const erro = cfg.validar(dadosNova);
  if (erro) { document.getElementById('assoc-nova-aviso-' + tipo).textContent = erro; return; }
  const tempId = 'novo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  assocSel[tipo].novas.push({ tempId, dados: dadosNova, label: cfg.label(dadosNova) });
  fecharNovaInline(tipo);
  renderAssocSel(tipo);
}

function renderAssocSel(tipo) {
  const cont = document.getElementById('assoc-sel-' + tipo);
  if (!cont) return;
  const items = assocConfig[tipo].items();
  const existentes = [...assocSel[tipo].existentes]
    .map(id => { const it = items.find(x => x.id === id); return it ? { key: 'e:' + id, label: it.label, novo: false } : null; })
    .filter(Boolean);
  const novas = assocSel[tipo].novas.map(n => ({ key: 'n:' + n.tempId, label: n.label, novo: true }));
  const todas = existentes.concat(novas);
  cont.innerHTML = todas.length
    ? todas.map(c => `<div class="resultado-item selecionado assoc-chip" data-key="${esc(c.key)}"><strong>${esc(c.label)}${c.novo ? ' (nova)' : ''}</strong><span class="assoc-remover" title="Remover">✕</span></div>`).join('')
    : `<p class="empty">Nenhum selecionado.</p>`;
  cont.querySelectorAll('.assoc-remover').forEach(x => {
    x.addEventListener('click', () => {
      const key = x.closest('.assoc-chip').dataset.key;
      if (key.startsWith('e:')) assocSel[tipo].existentes.delete(key.slice(2));
      else assocSel[tipo].novas = assocSel[tipo].novas.filter(n => n.tempId !== key.slice(2));
      renderAssocSel(tipo);
    });
  });
}

// ---- FORMULÁRIO DE EMPRESA (partilhado entre criar e editar) ----
function empresaCamposHTML(empresa) {
  const corAtual = empresa.cor || 'blue';
  return `
      <div class="form-grid">
        <div class="form-group"><label>Nome *</label><input type="text" id="ed-nome" value="${esc(empresa.nome || '')}" /></div>
        <div class="form-group"><label>Distrito *</label>
          <select id="ed-distrito">
            <option value="">— Selecionar —</option>
            ${distritoOptionsHTML(empresa.distrito)}
          </select>
        </div>
        <div class="form-group"><label>Localidade</label><input type="text" id="ed-localizacao" value="${esc(empresa.localizacao || '')}" /></div>
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
            <div class="form-group"><label>Data de Início</label><input type="date" id="ed-data-inicio" value="${esc(empresa.data_inicio || '')}" /></div>
          </div>
        </div>
        <div class="form-group"><label>Email</label><input type="email" id="ed-email" value="${esc(empresa.email || '')}" /></div>
        <div class="form-group"><label>Telefone</label><input type="text" id="ed-telefone" value="${esc(empresa.telefone || '')}" /></div>
      </div>
      <div class="form-group"><label>Notas</label><textarea id="ed-notas">${esc(empresa.notas || '')}</textarea></div>
      <div class="form-group"><label>Cor do badge</label>
        <div class="cor-palette" id="ed-cor-palette">
          ${TRELLO_CORES.map(c => `<button type="button" class="cor-swatch${c.nome === corAtual ? ' selecionado' : ''}" data-cor="${c.nome}" style="background:${c.hex}" title="${c.nome}"></button>`).join('')}
        </div>
      </div>
  `;
}

function wireEmpresaCampos() {
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
}

function lerEmpresaForm() {
  const setor = val('ed-setor');
  const plano = setor === 'Restaurante' ? val('ed-plano') : '';
  const data_inicio = (plano && plano !== 'Sem Avença') ? val('ed-data-inicio') : '';
  const cor = (document.querySelector('#ed-cor-palette .cor-swatch.selecionado') || { dataset: {} }).dataset.cor || 'blue';
  return {
    nome: val('ed-nome').trim(),
    distrito: val('ed-distrito'),
    localizacao: val('ed-localizacao').trim(),
    setor, plano, data_inicio,
    email: val('ed-email').trim(),
    telefone: val('ed-telefone').trim(),
    notas: val('ed-notas').trim(),
    cor
  };
}

function editarEmpresaForm(empresaId) {
  const empresa = dados.empresas.find(e => e.empresa_id === empresaId);
  if (!empresa) return;
  const detalhe = document.getElementById('empresa-detalhe');
  detalhe.innerHTML = `
    <div class="section">
      <h2>Editar empresa</h2>
      ${empresaCamposHTML(empresa)}
      <span class="field-error-msg" id="ed-aviso"></span>
      <div class="form-actions">
        <button id="ed-cancelar" class="btn-secondary">Cancelar</button>
        <button id="ed-guardar" class="btn-primary">Guardar</button>
      </div>
    </div>
  `;
  wireEmpresaCampos();
  document.getElementById('ed-cancelar').addEventListener('click', () => mostrarDetalheEmpresa(empresaId));
  document.getElementById('ed-guardar').addEventListener('click', () => guardarEmpresa(empresaId));
}

async function guardarEmpresa(empresaId) {
  const atualizada = lerEmpresaForm();
  if (!atualizada.nome || !atualizada.distrito || !atualizada.setor) {
    document.getElementById('ed-aviso').textContent = 'Nome, distrito e setor são obrigatórios.';
    return;
  }
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

function criarEmpresaForm() {
  assocSel.pessoas = { existentes: new Set(), novas: [] };
  const resultados = document.getElementById('empresa-resultados');
  if (resultados) resultados.innerHTML = '';
  const input = document.getElementById('search-empresa-board');
  if (input) input.value = '';
  const detalhe = document.getElementById('empresa-detalhe');
  detalhe.innerHTML = `
    <div class="section">
      <h2>Nova empresa</h2>
      ${empresaCamposHTML({})}
      <span class="field-error-msg" id="ed-aviso"></span>
    </div>
    ${assocWidgetHTML('pessoas', 'Associar pessoas * (pelo menos uma)', 'Pesquisar pessoa...')}
    <div class="form-actions">
      <button id="ed-cancelar" class="btn-secondary">Cancelar</button>
      <button id="ed-guardar" class="btn-primary">Criar empresa</button>
    </div>
  `;
  wireEmpresaCampos();
  wireAssocWidget('pessoas');
  document.getElementById('ed-cancelar').addEventListener('click', () => { detalhe.innerHTML = ''; });
  document.getElementById('ed-guardar').addEventListener('click', guardarNovaEmpresa);
}

async function guardarNovaEmpresa() {
  const e = lerEmpresaForm();
  if (!e.nome || !e.distrito || !e.setor) {
    document.getElementById('ed-aviso').textContent = 'Nome, distrito e setor são obrigatórios.';
    return;
  }
  const existentes = [...assocSel.pessoas.existentes];
  const novas = assocSel.pessoas.novas;
  if (!existentes.length && !novas.length) {
    document.getElementById('ed-aviso').textContent = 'Associa pelo menos uma pessoa.';
    return;
  }
  const detalhe = document.getElementById('empresa-detalhe');
  detalhe.innerHTML = `<p class="empty">A criar...</p>`;
  try {
    const empresa_id = await SheetsAPI.createEmpresa(token, e);
    dados.empresas.push({ empresa_id, ...e });
    for (const pid of existentes) {
      try { await SheetsAPI.addPessoaEmpresa(token, pid, empresa_id); dados.pessoaEmpresas.push({ pessoa_id: pid, empresa_id }); } catch (err) {}
    }
    for (const n of novas) {
      const pessoa_id = await SheetsAPI.createPessoa(token, { empresa_id, ...n.dados });
      dados.pessoas.push({ pessoa_id, empresa_id, ...n.dados });
      try { await SheetsAPI.addPessoaEmpresa(token, pessoa_id, empresa_id); dados.pessoaEmpresas.push({ pessoa_id, empresa_id }); } catch (err) {}
    }
    renderPessoasTab();
    renderListaTab();
    mostrarDetalheEmpresa(empresa_id);
  } catch (err) {
    detalhe.innerHTML = `<p class="empty">Erro ao criar: ${esc(err.message)}</p>`;
  }
}
