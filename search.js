// ============================================================
// SEARCH.JS — Vista de pesquisa CRM board-level
// ============================================================

let t;
let token = null;
let dados = { empresas: [], pessoas: [], pessoaEmpresas: [], cardAssoc: [], boardId: null };
let importLinhas = [];

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

function apagarEmpresaConfirm(empresaId) {
  const empresa = dados.empresas.find(e => e.empresa_id === empresaId);
  if (!empresa) return;

  const nCards = dados.cardAssoc.filter(a => a.empresa_id === empresaId).length;
  const pessoaIds = new Set([
    ...dados.pessoaEmpresas.filter(pe => pe.empresa_id === empresaId).map(pe => pe.pessoa_id),
    ...dados.pessoas.filter(p => p.empresa_id === empresaId).map(p => p.pessoa_id)
  ]);
  let nOrfas = 0;
  pessoaIds.forEach(pid => {
    const set = new Set(dados.pessoaEmpresas.filter(pe => pe.pessoa_id === pid).map(pe => pe.empresa_id));
    const p = dados.pessoas.find(x => x.pessoa_id === pid);
    if (p && p.empresa_id) set.add(p.empresa_id);
    if ([...set].every(e => e === empresaId)) nOrfas++;
  });

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
    await SheetsAPI.deleteEmpresa(token, empresaId);
    await carregarDados();
    renderEmpresasTab();
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
    await carregarDados();
    renderPessoasTab();
  } catch (err) {
    detalhe.innerHTML = `<p class="empty">Erro ao apagar: ${esc(err.message)}</p>`;
  }
}

// ---- SEPARADOR LISTA (filtros + exportar) ----

function renderListaTab() {
  const panel = document.getElementById('tab-lista');
  const cidades = [...new Set(dados.empresas.map(e => e.localizacao).filter(Boolean))].sort();

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
        <label>Cidade</label>
        <select id="f-cidade">
          <option value="">Todas</option>
          ${cidades.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
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

  ['f-setor', 'f-cargo', 'f-cidade', 'f-data-de', 'f-data-ate'].forEach(id => {
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
      cidade: empresa ? (empresa.localizacao || '') : '',
      setor: empresa ? (empresa.setor || '') : '',
      criadoEm: dataCriacaoDaPessoaId(p.pessoa_id)
    };
  });
}

function filtrarContactos() {
  const q = val('f-texto').toLowerCase().trim();
  const setor = val('f-setor');
  const cargo = val('f-cargo');
  const cidade = val('f-cidade');
  const dataDe = val('f-data-de');
  const dataAte = val('f-data-ate');
  const deTs = dataDe ? new Date(dataDe + 'T00:00:00').getTime() : null;
  const ateTs = dataAte ? new Date(dataAte + 'T23:59:59').getTime() : null;

  return contactosComEmpresa().filter(c => {
    if (q && !`${c.nome} ${c.email} ${c.empresaNome}`.toLowerCase().includes(q)) return false;
    if (setor && c.setor !== setor) return false;
    if (cargo && c.cargo !== cargo) return false;
    if (cidade && c.cidade !== cidade) return false;
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
          <th>Nome</th><th>Cargo</th><th>Empresa</th><th>Cidade</th><th>Setor</th><th>Email</th><th>Telemóvel</th><th>Criado</th>
        </tr>
      </thead>
      <tbody>
        ${lista.map(c => `
          <tr class="crm-linha" data-pessoa-id="${esc(c.pessoa.pessoa_id)}">
            <td>${esc(c.nome)}</td>
            <td>${esc(c.cargo) || '—'}</td>
            <td>${esc(c.empresaNome) || '—'}</td>
            <td>${esc(c.cidade) || '—'}</td>
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
  const cabecalho = ['Nome', 'Apelido', 'Cargo', 'Função', 'Email', 'Telemóvel', 'Empresa', 'Cidade', 'Setor', 'Criado em'];
  const linhas = lista.map(c => [
    c.pessoa.nome || '', c.pessoa.apelido || '', c.cargo, c.funcao, c.email, c.telemovel,
    c.empresaNome, c.cidade, c.setor, c.criadoEm ? c.criadoEm.toISOString().slice(0, 10) : ''
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

// ---- SEPARADOR IMPORTAR ----

function renderImportarTab() {
  const panel = document.getElementById('tab-importar');
  panel.innerHTML = `
    <div class="section">
      <h2>Importar contactos</h2>
      <p class="hint">Carrega um CSV ou cola os dados. Colunas: Nome, Apelido, Cargo, Função, Email, Telemóvel, Empresa, Cidade, Setor. A 1ª linha é o cabeçalho. Só "Nome" é obrigatório.</p>
      <div class="form-group">
        <label>Ficheiro CSV</label>
        <input type="file" id="imp-ficheiro" accept=".csv,text/csv" />
      </div>
      <div class="form-group">
        <label>...ou colar aqui</label>
        <textarea id="imp-texto" placeholder="Nome,Apelido,Cargo,Email,Empresa,Cidade,Setor&#10;João,Silva,Gerência,joao@x.pt,Restaurante X,Lisboa,Restaurante"></textarea>
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
    const csv = 'Nome,Apelido,Cargo,Função,Email,Telemóvel,Empresa,Cidade,Setor\r\nJoão,Silva,Gerência,,joao@exemplo.pt,912345678,Restaurante X,Lisboa,Restaurante';
    baixarCSV(csv, 'modelo-contactos.csv');
  });
}

function normalizarCol(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
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
    empresa: 'empresa', cidade: 'cidade', localizacao: 'cidade', setor: 'setor', sector: 'setor'
  };
  const cab = linhas[0].map(normalizarCol);
  const idx = {};
  cab.forEach((h, c) => { if (mapa[h] && idx[mapa[h]] === undefined) idx[mapa[h]] = c; });
  if (idx.nome === undefined) {
    aviso.textContent = 'Não encontrei a coluna "Nome" no cabeçalho.';
    return;
  }

  const campos = ['nome', 'apelido', 'cargo', 'funcao', 'email', 'telemovel', 'empresa', 'cidade', 'setor'];
  importLinhas = linhas.slice(1).map(cols => {
    const o = { estado: 'pendente' };
    campos.forEach(f => { o[f] = idx[f] !== undefined ? (cols[idx[f]] || '').trim() : ''; });
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

function renderImportStaging() {
  const cont = document.getElementById('imp-staging');
  if (!importLinhas.length) { cont.innerHTML = ''; return; }

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
      <button id="imp-aprovar-sel" class="btn-primary" style="flex:0 0 auto;">Aprovar selecionados</button>
    </div>
    <div class="tabela-scroll">
      <table class="crm-tabela imp-tabela">
        <thead>
          <tr>
            <th><input type="checkbox" id="imp-check-todos" /></th>
            <th>Nome</th><th>Apelido</th><th>Cargo</th><th>Função</th><th>Email</th><th>Telemóvel</th><th>Empresa</th><th>Cidade</th><th>Setor</th><th>Estado</th><th></th>
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
  importLinhas.forEach((l, i) => {
    if (l.estado !== 'pendente') return;
    const btnA = document.getElementById('imp-aprovar-' + i);
    const btnR = document.getElementById('imp-recusar-' + i);
    if (btnA) btnA.addEventListener('click', () => aprovarLinha(i));
    if (btnR) btnR.addEventListener('click', () => recusarLinha(i));
  });
}

function linhaImportHTML(l, i) {
  if (l.estado === 'recusado') return '';
  if (l.estado === 'importado') {
    return `<tr class="imp-importado">
      <td>✓</td>
      <td>${esc(l.nome)}</td><td>${esc(l.apelido)}</td><td>${esc(l.cargo)}</td><td>${esc(l.funcao)}</td>
      <td>${esc(l.email)}</td><td>${esc(l.telemovel)}</td><td>${esc(l.empresa)}</td><td>${esc(l.cidade)}</td><td>${esc(l.setor)}</td>
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
    <td><input type="text" id="imp-${i}-cidade" value="${esc(l.cidade)}" /></td>
    <td>${selectImportHTML('imp-' + i + '-setor', ['Restaurante', 'Outro'], l.setor)}</td>
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
    ['nome', 'apelido', 'cargo', 'funcao', 'email', 'telemovel', 'empresa', 'cidade', 'setor'].forEach(c => {
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
        empresa_id = await SheetsAPI.createEmpresa(token, {
          nome: l.empresa, localizacao: l.cidade, setor: l.setor || 'Outro',
          plano: '', data_inicio: '', email: '', telefone: '', notas: '', cor: 'blue'
        });
        dados.empresas.push({ empresa_id, nome: l.empresa, localizacao: l.cidade, setor: l.setor || 'Outro', cor: 'blue' });
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
