// ============================================================
// SIDEBAR.JS — Lógica principal do painel CRM
// ============================================================

let t;
let currentCard = null;
let currentEmpresa = null;
let currentPessoa = null;

// ---- INIT ----

document.addEventListener('DOMContentLoaded', async () => {
  t = TrelloPowerUp.iframe();
  currentCard = await t.card('id', 'name');
  await renderPanel();
});

async function renderPanel() {
  showLoading();
  try {
    const token = await Auth.ensureToken();
    const associacao = await SheetsAPI.getCardAssociacao(token, currentCard.id);

    if (!associacao) {
      showAssociacaoPanel(token);
    } else {
      const empresas = await SheetsAPI.getEmpresas(token);
      const pessoas = await SheetsAPI.getPessoas(token);
      currentEmpresa = empresas.find(e => e.empresa_id === associacao.empresa_id);
      currentPessoa = pessoas.find(p => p.pessoa_id === associacao.pessoa_id);
      showClientePanel(token);
    }
  } catch (err) {
    showError(err.message);
  }
}

// ---- PAINEL: SEM ASSOCIAÇÃO ----

function showAssociacaoPanel(token) {
  const panel = document.getElementById('crm-panel');
  panel.innerHTML = `
    <div class="section">
      <h2>Associar Cliente</h2>
      <p class="empty">Este card ainda não está associado a nenhum cliente.</p>
      <button id="btn-associar" class="btn-primary">Associar Empresa / Pessoa</button>
    </div>
  `;
  document.getElementById('btn-associar').addEventListener('click', () => {
    showFormEmpresa(token);
  });
}

// ---- PAINEL: CLIENTE ASSOCIADO ----

function showClientePanel(token) {
  const panel = document.getElementById('crm-panel');
  const e = currentEmpresa || {};
  const p = currentPessoa || {};

  panel.innerHTML = `
    <div class="section" id="section-empresa">
      <div class="section-header">
        <h2>${e.nome || '—'}</h2>
        <button class="btn-link" id="btn-editar-associacao">Alterar</button>
      </div>
      <div class="info-row"><span class="label">Localização</span><span>${e.localizacao || '—'}</span></div>
      <div class="info-row"><span class="label">Setor</span><span>${e.setor || '—'}</span></div>
      ${e.setor === 'Restaurante' ? `<div class="info-row"><span class="label">Plano</span><span>${e.plano || '—'}</span></div>` : ''}
      ${e.email ? `<div class="info-row"><span class="label">Email</span><span>${e.email}</span></div>` : ''}
      ${e.telefone ? `<div class="info-row"><span class="label">Telefone</span><span>${e.telefone}</span></div>` : ''}
      ${e.notas ? `<div class="info-row"><span class="label">Notas</span><span>${e.notas}</span></div>` : ''}
    </div>

    <div class="section" id="section-pessoa">
      <h3>Contacto</h3>
      <div class="info-row"><span class="label">Nome</span><span>${p.nome || '—'} ${p.apelido || ''}</span></div>
      <div class="info-row"><span class="label">Cargo</span><span>${p.cargo || '—'}</span></div>
      ${p.funcao ? `<div class="info-row"><span class="label">Função</span><span>${p.funcao}</span></div>` : ''}
      ${p.email ? `<div class="info-row"><span class="label">Email</span><span>${p.email}</span></div>` : ''}
      ${p.telemovel ? `<div class="info-row"><span class="label">Telemóvel</span><span>${p.telemovel}</span></div>` : ''}
    </div>

    <div class="section" id="section-emails">
      <h3>Histórico de Emails</h3>
      <div id="email-list"><p class="empty">A carregar emails...</p></div>
    </div>

    <div class="section" id="section-enviar">
      <h3>Enviar Email</h3>
      <input type="text" id="email-subject" placeholder="Assunto" />
      <textarea id="email-body" placeholder="Mensagem..."></textarea>
      <button id="send-btn" class="btn-primary">Enviar</button>
    </div>
  `;

  document.getElementById('btn-editar-associacao').addEventListener('click', () => {
    showFormEmpresa(token);
  });
}

// ---- FORMULÁRIO: EMPRESA ----

async function showFormEmpresa(token) {
  showLoading();
  const empresas = await SheetsAPI.getEmpresas(token);
  const panel = document.getElementById('crm-panel');

  panel.innerHTML = `
    <div class="section">
      <h2>Selecionar Empresa</h2>

      <div class="form-group">
        <label>Empresa existente</label>
        <select id="select-empresa">
          <option value="">— Selecionar —</option>
          ${empresas.map(e => `<option value="${e.empresa_id}">${e.nome}</option>`).join('')}
          <option value="nova">+ Criar nova empresa</option>
        </select>
      </div>

      <div id="form-nova-empresa" style="display:none;">
        <div class="form-group">
          <label>Nome *</label>
          <input type="text" id="emp-nome" placeholder="Nome da empresa" />
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
        <div id="form-restaurante" style="display:none;">
          <div class="form-group">
            <label>Plano</label>
            <select id="emp-plano">
              <option value="Sem Avença">Sem Avença</option>
              <option value="ARD">ARD</option>
              <option value="ARD Pro">ARD Pro</option>
              <option value="ARD Premium">ARD Premium</option>
            </select>
          </div>
          <div id="form-data-inicio" style="display:none;">
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

      <div class="form-actions">
        <button id="btn-next-empresa" class="btn-primary">Seguinte →</button>
      </div>
    </div>
  `;

  document.getElementById('select-empresa').addEventListener('change', function() {
    document.getElementById('form-nova-empresa').style.display =
      this.value === 'nova' ? 'block' : 'none';
  });

  document.getElementById('emp-setor').addEventListener('change', function() {
    document.getElementById('form-restaurante').style.display =
      this.value === 'Restaurante' ? 'block' : 'none';
  });

  document.getElementById('emp-plano').addEventListener('change', function() {
    document.getElementById('form-data-inicio').style.display =
      this.value !== 'Sem Avença' ? 'block' : 'none';
  });

  document.getElementById('btn-next-empresa').addEventListener('click', async () => {
    await handleNextEmpresa(token, empresas);
  });
}

async function handleNextEmpresa(token, empresas) {
  const select = document.getElementById('select-empresa');
  const valor = select.value;

  if (!valor) {
    showFieldError('select-empresa', 'Seleciona ou cria uma empresa.');
    return;
  }

  if (valor === 'nova') {
    const nome = document.getElementById('emp-nome').value.trim();
    const localizacao = document.getElementById('emp-localizacao').value.trim();
    const setor = document.getElementById('emp-setor').value;

    if (!nome || !localizacao || !setor) {
      if (!nome) showFieldError('emp-nome', 'Obrigatório');
      if (!localizacao) showFieldError('emp-localizacao', 'Obrigatório');
      if (!setor) showFieldError('emp-setor', 'Obrigatório');
      return;
    }

    const planoEl = document.getElementById('emp-plano');
    const plano = (setor === 'Restaurante' && planoEl) ? planoEl.value : '';
    const dataInicioEl = document.getElementById('emp-data-inicio');
    const data_inicio = (plano && plano !== 'Sem Avença' && dataInicioEl) ? dataInicioEl.value : '';
    const emailEl = document.getElementById('emp-email');
    const telefoneEl = document.getElementById('emp-telefone');
    const notasEl = document.getElementById('emp-notas');

    showLoading();
    const empresa_id = await SheetsAPI.createEmpresa(token, {
      nome,
      localizacao,
      setor,
      plano,
      data_inicio,
      email: emailEl ? emailEl.value.trim() : '',
      telefone: telefoneEl ? telefoneEl.value.trim() : '',
      notas: notasEl ? notasEl.value.trim() : ''
    });
    currentEmpresa = { empresa_id, nome, localizacao, setor, plano };
  } else {
    currentEmpresa = empresas.find(e => e.empresa_id === valor);
  }

  await showFormPessoa(token);
}

// ---- FORMULÁRIO: PESSOA ----

async function showFormPessoa(token) {
  showLoading();
  const pessoas = await SheetsAPI.getPessoas(token, currentEmpresa.empresa_id);
  const panel = document.getElementById('crm-panel');

  panel.innerHTML = `
    <div class="section">
      <h2>Selecionar Pessoa</h2>
      <p class="sub">Empresa: <strong>${currentEmpresa.nome}</strong></p>

      <div class="form-group">
        <label>Pessoa existente</label>
        <select id="select-pessoa">
          <option value="">— Selecionar —</option>
          ${pessoas.map(p => `<option value="${p.pessoa_id}">${p.nome} ${p.apelido}</option>`).join('')}
          <option value="nova">+ Criar nova pessoa</option>
        </select>
      </div>

      <div id="form-nova-pessoa" style="display:none;">
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
      </div>

      <div class="form-actions">
        <button id="btn-back-pessoa" class="btn-secondary">← Voltar</button>
        <button id="btn-save-pessoa" class="btn-primary">Guardar</button>
      </div>
    </div>
  `;

  document.getElementById('select-pessoa').addEventListener('change', function() {
    document.getElementById('form-nova-pessoa').style.display =
      this.value === 'nova' ? 'block' : 'none';
  });

  document.getElementById('pes-cargo').addEventListener('change', function() {
    document.getElementById('form-funcao').style.display =
      this.value === 'Colaborador' ? 'block' : 'none';
  });

  document.getElementById('btn-back-pessoa').addEventListener('click', () => {
    showFormEmpresa(token);
  });

  document.getElementById('btn-save-pessoa').addEventListener('click', async () => {
    await handleSavePessoa(token, pessoas);
  });
}

async function handleSavePessoa(token, pessoas) {
  const select = document.getElementById('select-pessoa');
  const valor = select.value;

  if (!valor) {
    showFieldError('select-pessoa', 'Seleciona ou cria uma pessoa.');
    return;
  }

  if (valor === 'nova') {
    const nome = document.getElementById('pes-nome').value.trim();
    const apelido = document.getElementById('pes-apelido').value.trim();
    const cargo = document.getElementById('pes-cargo').value;
    const emailEl = document.getElementById('pes-email');
    const telemovelEl = document.getElementById('pes-telemovel');
    const email = emailEl ? emailEl.value.trim() : '';
    const telemovel = telemovelEl ? telemovelEl.value.trim() : '';

    if (!nome || !apelido || !cargo) {
      if (!nome) showFieldError('pes-nome', 'Obrigatório');
      if (!apelido) showFieldError('pes-apelido', 'Obrigatório');
      if (!cargo) showFieldError('pes-cargo', 'Obrigatório');
      return;
    }

    if (!email && !telemovel) {
      showError('Preenche pelo menos o email ou o telemóvel.');
      return;
    }

    const funcaoEl = document.getElementById('pes-funcao');
    showLoading();
    const pessoa_id = await SheetsAPI.createPessoa(token, {
      empresa_id: currentEmpresa.empresa_id,
      nome,
      apelido,
      cargo,
      funcao: funcaoEl ? funcaoEl.value.trim() : '',
      email,
      telemovel
    });
    currentPessoa = { pessoa_id, nome, apelido, cargo, email, telemovel };
  } else {
    currentPessoa = pessoas.find(p => p.pessoa_id === valor);
  }

  showLoading();
  await SheetsAPI.saveCardAssociacao(token, currentCard.id, currentEmpresa.empresa_id, currentPessoa.pessoa_id);
  await renderPanel();
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
