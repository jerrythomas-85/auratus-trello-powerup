// ============================================================
// SIDEBAR.JS — Lógica principal do painel CRM
// ============================================================

let t;
let currentCard = null;
let currentEmpresa = null;
let currentPessoa = null;
let allEmpresas = [];
let allPessoas = [];

// ---- INIT ----

document.addEventListener('DOMContentLoaded', async () => {
  t = TrelloPowerUp.iframe();
  if (window.CRM_EMBEDDED) {
    const panel = document.getElementById('crm-panel');
    new MutationObserver(() => t.sizeTo('#crm-panel')).observe(panel, { childList: true, subtree: true });
  }
  currentCard = await t.card('id', 'name');
  await renderPanel();
});

async function renderPanel() {
  showLoading();
  try {
    const token = await Auth.ensureToken();
    const [associacao, empresas, pessoas] = await Promise.all([
      SheetsAPI.getCardAssociacao(token, currentCard.id),
      SheetsAPI.getEmpresas(token),
      SheetsAPI.getPessoas(token)
    ]);
    allEmpresas = empresas;
    allPessoas = pessoas;

    if (!associacao) {
      if (window.CRM_EMBEDDED) {
        showAssociarButton(token);
      } else {
        showSearchPessoa(token);
      }
    } else {
      currentEmpresa = empresas.find(e => e.empresa_id === associacao.empresa_id);
      currentPessoa = pessoas.find(p => p.pessoa_id === associacao.pessoa_id);
      await setBadgeLocal();
      showClientePanel(token);
    }
  } catch (err) {
    showError(err.message);
  }
}

// ---- PAINEL: CLIENTE ASSOCIADO ----

function showClientePanel(token) {
  const panel = document.getElementById('crm-panel');
  const e = currentEmpresa || {};
  const p = currentPessoa || {};

  panel.innerHTML = `
    <div class="cliente-cols">
    <div class="section">
      <div class="section-header">
        <h2>${e.nome || '—'}</h2>
        <button class="btn-link" id="btn-alterar">Alterar</button>
      </div>
      <div class="info-row"><span class="label">Localização</span><span>${e.localizacao || '—'}</span></div>
      <div class="info-row"><span class="label">Setor</span><span>${e.setor || '—'}</span></div>
      ${e.setor === 'Restaurante' ? `<div class="info-row"><span class="label">Plano</span><span>${e.plano || '—'}</span></div>` : ''}
      ${e.email ? `<div class="info-row"><span class="label">Email</span><span>${e.email}</span></div>` : ''}
      ${e.telefone ? `<div class="info-row"><span class="label">Telefone</span><span>${e.telefone}</span></div>` : ''}
      ${e.notas ? `<div class="info-row"><span class="label">Notas</span><span>${e.notas}</span></div>` : ''}
    </div>

    <div class="section">
      <h3>Contacto</h3>
      <div class="info-row"><span class="label">Nome</span><span>${p.nome || '—'} ${p.apelido || ''}</span></div>
      <div class="info-row"><span class="label">Cargo</span><span>${p.cargo || '—'}</span></div>
      ${p.funcao ? `<div class="info-row"><span class="label">Função</span><span>${p.funcao}</span></div>` : ''}
      ${p.email ? `<div class="info-row"><span class="label">Email</span><span>${p.email}</span></div>` : ''}
      ${p.telemovel ? `<div class="info-row"><span class="label">Telemóvel</span><span>${p.telemovel}</span></div>` : ''}
    </div>
    </div>
  `;

  document.getElementById('btn-alterar').addEventListener('click', () => {
    showSearchPessoa(token);
  });
}

// ---- PAINEL EMBUTIDO: SEM CONTACTO (Estado A) ----

function showAssociarButton(token) {
  const panel = document.getElementById('crm-panel');
  panel.innerHTML = `
    <div class="section">
      <button id="btn-associar" class="btn-primary">Associar pessoa</button>
    </div>
  `;
  document.getElementById('btn-associar').addEventListener('click', () => {
    showSearchPessoa(token);
  });
}

// Guarda nome da pessoa + empresa no próprio card (storage local do Power-Up),
// para o badge ler sem OAuth nem ir à Sheet. Nunca rebenta o fluxo de associação.
async function setBadgeLocal() {
  try {
    if (!currentPessoa || !currentEmpresa) return;
    const pessoa = ((currentPessoa.nome || '') + ' ' + (currentPessoa.apelido || '')).trim();
    await t.set('card', 'shared', 'crmBadge', { pessoa, empresa: (currentEmpresa.nome || '').toUpperCase() });
  } catch (e) {}
}

// ---- PESQUISA DE PESSOA ----

function showSearchPessoa(token) {
  const panel = document.getElementById('crm-panel');

  panel.innerHTML = `
    <div class="section">
      <h2>Associar Contacto</h2>
      <div class="form-group">
        <input type="text" id="search-pessoa" placeholder="Pesquisar pessoa..." autocomplete="off" />
      </div>
      <div id="resultados-pessoa" class="resultados">
        <p class="empty">Escreve para pesquisar...</p>
      </div>
      <button id="btn-nova-pessoa" class="btn-secondary" style="margin-top:8px;">+ Criar nova pessoa</button>
    </div>
  `;

  const input = document.getElementById('search-pessoa');
  const resultados = document.getElementById('resultados-pessoa');

  input.addEventListener('input', function() {
    const q = this.value.toLowerCase();
    if (q.length === 0) {
      resultados.innerHTML = `<p class="empty">Escreve para pesquisar...</p>`;
      return;
    }
    const filtradas = allPessoas.filter(p =>
      (p.nome + ' ' + p.apelido).toLowerCase().includes(q)
    );
    renderResultadosPessoa(resultados, filtradas, token);
  });

  document.getElementById('btn-nova-pessoa').addEventListener('click', () => {
    showFormNovaPessoa(token);
  });
}

function renderResultadosPessoa(container, pessoas, token) {
  if (pessoas.length === 0) {
    container.innerHTML = `<p class="empty">Nenhuma pessoa encontrada.</p>`;
    return;
  }
  container.innerHTML = pessoas.map(p => {
    const empresa = allEmpresas.find(e => e.empresa_id === p.empresa_id);
    return `
      <div class="resultado-item" data-pessoa-id="${p.pessoa_id}">
        <strong>${p.nome} ${p.apelido}</strong>
        <span>${empresa ? empresa.nome : '—'} · ${p.cargo}</span>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.resultado-item').forEach(item => {
    item.addEventListener('click', async () => {
      const pessoa_id = item.dataset.pessoaId;
      const pessoa = allPessoas.find(p => p.pessoa_id === pessoa_id);
      const empresa = allEmpresas.find(e => e.empresa_id === pessoa.empresa_id);
      currentPessoa = pessoa;
      currentEmpresa = empresa;
      showLoading();
      await SheetsAPI.saveCardAssociacao(token, currentCard.id, empresa.empresa_id, pessoa.pessoa_id);
      await setBadgeLocal();
      showClientePanel(token);
    });
  });
}

// ---- FORMULÁRIO: NOVA PESSOA ----

function showFormNovaPessoa(token) {
  const panel = document.getElementById('crm-panel');

  panel.innerHTML = `
    <div class="section">
      <h2>Nova Pessoa</h2>

      <div class="form-group">
        <label>Nome *</label>
        <input type="text" id="pes-nome" placeholder="Nome" />
      </div>
      <div class="form-group">
        <label>Apelido *</label>
        <input type="text" id="pes-apelido" placeholder="Apelido" />
      </div>
      <div class="form-group">
        <label>Cargo *</label>
        <select id="pes-cargo">
          <option value="">— Selecionar —</option>
          <option value="Gerência">Gerência</option>
          <option value="Colaborador">Colaborador</option>
        </select>
      </div>
      <div id="form-funcao" style="display:none;">
        <div class="form-group">
          <label>Função</label>
          <input type="text" id="pes-funcao" placeholder="Ex: Cozinheiro, Gestor..." />
        </div>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="pes-email" placeholder="email@exemplo.com" />
      </div>
      <div class="form-group">
        <label>Telemóvel</label>
        <input type="text" id="pes-telemovel" placeholder="+351 000 000 000" />
      </div>
      <p class="hint">* Email ou Telemóvel — pelo menos um obrigatório</p>

      <div id="bloco-empresa" style="margin-top:16px;">
        <div class="form-group">
          <label>Empresa *</label>
          <input type="text" id="search-empresa" placeholder="Pesquisar empresa..." autocomplete="off" />
        </div>
        <div id="resultados-empresa" class="resultados">
          <p class="empty">Escreve para pesquisar...</p>
        </div>
      </div>
      <div id="form-nova-empresa-inline" style="display:none;"></div>

      <div class="form-actions" style="margin-top:16px;">
        <button id="btn-back-nova-pessoa" class="btn-secondary">← Voltar</button>
        <button id="btn-save-pessoa" class="btn-primary">Guardar</button>
      </div>
    </div>
  `;

  document.getElementById('pes-cargo').addEventListener('change', function() {
    document.getElementById('form-funcao').style.display =
      this.value === 'Colaborador' ? 'block' : 'none';
  });

  document.getElementById('btn-back-nova-pessoa').addEventListener('click', () => {
    showSearchPessoa(token);
  });

  const inputEmpresa = document.getElementById('search-empresa');
  const resultadosEmpresa = document.getElementById('resultados-empresa');

  inputEmpresa.addEventListener('input', function() {
    const q = this.value.toLowerCase();
    if (q.length === 0) {
      resultadosEmpresa.innerHTML = `<p class="empty">Escreve para pesquisar...</p>`;
      const existeBtnCriar = document.getElementById('btn-criar-empresa-inline');
      if (existeBtnCriar) existeBtnCriar.remove();
      return;
    }
    const filtradas = allEmpresas.filter(e => e.nome.toLowerCase().includes(q));
    renderResultadosEmpresa(resultadosEmpresa, filtradas, token);
    const match = allEmpresas.find(e => e.nome.toLowerCase() === q);
    const existeBtnCriar = document.getElementById('btn-criar-empresa-inline');
    if (!match) {
      if (!existeBtnCriar) {
        const btn = document.createElement('button');
        btn.id = 'btn-criar-empresa-inline';
        btn.className = 'btn-secondary';
        btn.style.marginTop = '6px';
        btn.style.width = '100%';
        btn.textContent = `+ Criar "${this.value}"`;
        resultadosEmpresa.after(btn);
        btn.addEventListener('click', () => {
          showFormNovaEmpresaInline(document.getElementById('search-empresa').value, token);
        });
      } else {
        existeBtnCriar.textContent = `+ Criar "${this.value}"`;
      }
    } else if (existeBtnCriar) {
      existeBtnCriar.remove();
    }
  });

  document.getElementById('btn-save-pessoa').addEventListener('click', async () => {
    await handleSaveNovaPessoa(token);
  });
}

function renderResultadosEmpresa(container, empresas, token) {
  if (empresas.length === 0) {
    container.innerHTML = `<p class="empty">Nenhuma empresa encontrada.</p>`;
    return;
  }
  container.innerHTML = empresas.map(e => `
    <div class="resultado-item ${currentEmpresa && currentEmpresa.empresa_id === e.empresa_id ? 'selecionado' : ''}" data-empresa-id="${e.empresa_id}">
      <strong>${e.nome}</strong>
      <span>${e.localizacao} · ${e.setor}</span>
    </div>
  `).join('');

  container.querySelectorAll('.resultado-item').forEach(item => {
    item.addEventListener('click', () => {
      container.querySelectorAll('.resultado-item').forEach(i => i.classList.remove('selecionado'));
      item.classList.add('selecionado');
      currentEmpresa = allEmpresas.find(e => e.empresa_id === item.dataset.empresaId);
      document.getElementById('form-nova-empresa-inline').style.display = 'none';
      document.getElementById('form-nova-empresa-inline').innerHTML = '';
    });
  });
}

function showFormNovaEmpresaInline(nomeInicial, token) {
  // Esconde o bloco de pesquisa de empresa
  const blocoEmpresa = document.getElementById('bloco-empresa');
  const btnCriar = document.getElementById('btn-criar-empresa-inline');
  if (blocoEmpresa) blocoEmpresa.style.display = 'none';
  if (btnCriar) btnCriar.style.display = 'none';

  const container = document.getElementById('form-nova-empresa-inline');
  container.style.display = 'block';
  container.innerHTML = `
    <div style="background:#f4f5f7;border-radius:6px;padding:12px;margin-top:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h3>Nova Empresa</h3>
        <button id="btn-voltar-pesquisa-empresa" class="btn-link">← Voltar à pesquisa</button>
      </div>
      <div class="form-group">
        <label>Nome *</label>
        <input type="text" id="emp-nome" value="${nomeInicial}" placeholder="Nome da empresa" />
      </div>
      <div class="form-group">
        <label>Localização *</label>
        <input type="text" id="emp-localizacao" placeholder="Cidade / Concelho" />
      </div>
      <div class="form-group">
        <label>Setor *</label>
        <select id="emp-setor">
          <option value="">— Selecionar —</option>
          <option value="Restaurante">Restaurante</option>
          <option value="Outro">Outro</option>
        </select>
      </div>
      <div id="form-restaurante-inline" style="display:none;">
        <div class="form-group">
          <label>Plano</label>
          <select id="emp-plano">
            <option value="Sem Avença">Sem Avença</option>
            <option value="ARD">ARD</option>
            <option value="ARD Pro">ARD Pro</option>
            <option value="ARD Premium">ARD Premium</option>
          </select>
        </div>
        <div id="form-data-inicio-inline" style="display:none;">
          <div class="form-group">
            <label>Data de Início</label>
            <input type="date" id="emp-data-inicio" />
          </div>
        </div>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="emp-email" placeholder="email@empresa.com" />
      </div>
      <div class="form-group">
        <label>Telefone</label>
        <input type="text" id="emp-telefone" placeholder="+351 000 000 000" />
      </div>
      <div class="form-group">
        <label>Notas</label>
        <textarea id="emp-notas" placeholder="Notas internas..."></textarea>
      </div>
    </div>
  `;

  document.getElementById('emp-setor').addEventListener('change', function() {
    document.getElementById('form-restaurante-inline').style.display =
      this.value === 'Restaurante' ? 'block' : 'none';
  });

  document.getElementById('emp-plano').addEventListener('change', function() {
    document.getElementById('form-data-inicio-inline').style.display =
      this.value !== 'Sem Avença' ? 'block' : 'none';
  });

  document.getElementById('btn-voltar-pesquisa-empresa').addEventListener('click', () => {
    container.style.display = 'none';
    container.innerHTML = '';
    if (blocoEmpresa) blocoEmpresa.style.display = 'block';
    currentEmpresa = null;
  });
}

async function handleSaveNovaPessoa(token) {
  const nome = (document.getElementById('pes-nome') || {value:''}).value.trim();
  const apelido = (document.getElementById('pes-apelido') || {value:''}).value.trim();
  const cargo = (document.getElementById('pes-cargo') || {value:''}).value;
  const email = (document.getElementById('pes-email') || {value:''}).value.trim();
  const telemovel = (document.getElementById('pes-telemovel') || {value:''}).value.trim();
  const funcao = (document.getElementById('pes-funcao') || {value:''}).value.trim();

  const formInline = document.getElementById('form-nova-empresa-inline');
  const inlineVisivel = formInline && formInline.style.display !== 'none' && formInline.innerHTML !== '';

  let empDados = null;
  if (inlineVisivel) {
    empDados = {
      nome: (document.getElementById('emp-nome') || {value:''}).value.trim(),
      localizacao: (document.getElementById('emp-localizacao') || {value:''}).value.trim(),
      setor: (document.getElementById('emp-setor') || {value:''}).value,
      plano: (document.getElementById('emp-plano') || {value:''}).value,
      data_inicio: (document.getElementById('emp-data-inicio') || {value:''}).value,
      email: (document.getElementById('emp-email') || {value:''}).value.trim(),
      telefone: (document.getElementById('emp-telefone') || {value:''}).value.trim(),
      notas: (document.getElementById('emp-notas') || {value:''}).value.trim()
    };
  }

  if (!nome || !apelido || !cargo) {
    if (!nome) showFieldError('pes-nome', 'Obrigatório');
    if (!apelido) showFieldError('pes-apelido', 'Obrigatório');
    if (!cargo) showFieldError('pes-cargo', 'Obrigatório');
    return;
  }

  if (!email && !telemovel) {
    showFieldError('pes-email', 'Preenche email ou telemóvel');
    return;
  }

  if (!currentEmpresa && !inlineVisivel) {
    showFieldError('search-empresa', 'Seleciona ou cria uma empresa.');
    return;
  }

  if (inlineVisivel && empDados && (!empDados.nome || !empDados.localizacao || !empDados.setor)) {
    if (!empDados.nome) showFieldError('emp-nome', 'Obrigatório');
    if (!empDados.localizacao) showFieldError('emp-localizacao', 'Obrigatório');
    if (!empDados.setor) showFieldError('emp-setor', 'Obrigatório');
    return;
  }

  showLoading();

  if (inlineVisivel && !currentEmpresa && empDados) {
    const plano = empDados.setor === 'Restaurante' ? empDados.plano : '';
    const data_inicio = (plano && plano !== 'Sem Avença') ? empDados.data_inicio : '';
    const empresa_id = await SheetsAPI.createEmpresa(token, {
      nome: empDados.nome,
      localizacao: empDados.localizacao,
      setor: empDados.setor,
      plano,
      data_inicio,
      email: empDados.email,
      telefone: empDados.telefone,
      notas: empDados.notas
    });
    currentEmpresa = { empresa_id, nome: empDados.nome, localizacao: empDados.localizacao, setor: empDados.setor, plano };
    allEmpresas.push(currentEmpresa);
  }

  const pessoa_id = await SheetsAPI.createPessoa(token, {
    empresa_id: currentEmpresa.empresa_id,
    nome,
    apelido,
    cargo,
    funcao,
    email,
    telemovel
  });

  currentPessoa = { pessoa_id, nome, apelido, cargo, email, telemovel };
  allPessoas.push(currentPessoa);

  await SheetsAPI.saveCardAssociacao(token, currentCard.id, currentEmpresa.empresa_id, pessoa_id);
  await setBadgeLocal();
  showClientePanel(token);
}

// ---- UTILITÁRIOS UI ----

function showLoading() {
  document.getElementById('crm-panel').innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>A carregar...</p>
    </div>
  `;
}

function showError(msg) {
  document.getElementById('crm-panel').innerHTML = `
    <div class="section">
      <div class="error-box">
        <p>⚠️ ${msg}</p>
        <button class="btn-primary" onclick="renderPanel()">Tentar novamente</button>
      </div>
    </div>
  `;
}

function showFieldError(fieldId, msg) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  field.classList.add('field-error');
  let err = field.parentNode.querySelector('.field-error-msg');
  if (!err) {
    err = document.createElement('span');
    err.className = 'field-error-msg';
    field.parentNode.appendChild(err);
  }
  err.textContent = msg;
  field.addEventListener('input', () => {
    field.classList.remove('field-error');
    if (err) err.remove();
  }, { once: true });
}
