// ============================================================
// SHEETS.JS — Funções de acesso à Google Sheets API
// ============================================================

const SheetsAPI = {

  baseURL: 'https://sheets.googleapis.com/v4/spreadsheets',

  headers(token) {
    return {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    };
  },

  // ---- EMPRESAS ----

  async getEmpresas(token) {
    const range = `${AURATUS_CONFIG.SHEETS.EMPRESAS}!A2:J`;
    const url = `${this.baseURL}/${AURATUS_CONFIG.SHEET_ID}/values/${range}`;
    const res = await fetch(url, { headers: this.headers(token) });
    const data = await res.json();
    if (!data.values) return [];
    return data.values.map(row => ({
      empresa_id: row[0] || '',
      nome: row[1] || '',
      localizacao: row[2] || '',
      setor: row[3] || '',
      plano: row[4] || '',
      data_inicio: row[5] || '',
      email: row[6] || '',
      telefone: row[7] || '',
      notas: row[8] || '',
      cor: row[9] || ''
    }));
  },

  async createEmpresa(token, empresa) {
    const id = 'EMP_' + Date.now();
    const row = [
      id,
      empresa.nome,
      empresa.localizacao,
      empresa.setor,
      empresa.plano || '',
      empresa.data_inicio || '',
      empresa.email || '',
      empresa.telefone || '',
      empresa.notas || '',
      empresa.cor || ''
    ];
    await this._appendRow(token, AURATUS_CONFIG.SHEETS.EMPRESAS, row);
    return id;
  },

  // ---- PESSOAS ----

  async getPessoas(token, empresa_id = null) {
    const range = `${AURATUS_CONFIG.SHEETS.PESSOAS}!A2:H`;
    const url = `${this.baseURL}/${AURATUS_CONFIG.SHEET_ID}/values/${range}`;
    const res = await fetch(url, { headers: this.headers(token) });
    const data = await res.json();
    if (!data.values) return [];
    const pessoas = data.values.map(row => ({
      pessoa_id: row[0] || '',
      empresa_id: row[1] || '',
      nome: row[2] || '',
      apelido: row[3] || '',
      cargo: row[4] || '',
      funcao: row[5] || '',
      email: row[6] || '',
      telemovel: row[7] || ''
    }));
    if (empresa_id) return pessoas.filter(p => p.empresa_id === empresa_id);
    return pessoas;
  },

  async createPessoa(token, pessoa) {
    const id = 'PES_' + Date.now();
    const row = [
      id,
      pessoa.empresa_id,
      pessoa.nome,
      pessoa.apelido,
      pessoa.cargo,
      pessoa.funcao || '',
      pessoa.email || '',
      pessoa.telemovel || ''
    ];
    await this._appendRow(token, AURATUS_CONFIG.SHEETS.PESSOAS, row);
    return id;
  },

  // ---- CARDS CRM ----

  async getCardAssociacao(token, card_id) {
    const range = `${AURATUS_CONFIG.SHEETS.CARDS_CRM}!A2:D`;
    const url = `${this.baseURL}/${AURATUS_CONFIG.SHEET_ID}/values/${range}`;
    const res = await fetch(url, { headers: this.headers(token) });
    const data = await res.json();
    if (!data.values) return null;
    const row = data.values.find(r => r[0] === card_id);
    if (!row) return null;
    return {
      card_id: row[0],
      empresa_id: row[1],
      pessoa_id: row[2],
      data_associacao: row[3]
    };
  },

  async saveCardAssociacao(token, card_id, empresa_id, pessoa_id) {
    const existente = await this.getCardAssociacao(token, card_id);
    if (existente) {
      await this._updateCardAssociacao(token, card_id, empresa_id, pessoa_id);
    } else {
      const row = [card_id, empresa_id, pessoa_id, new Date().toISOString()];
      await this._appendRow(token, AURATUS_CONFIG.SHEETS.CARDS_CRM, row);
    }
  },

  async _updateCardAssociacao(token, card_id, empresa_id, pessoa_id) {
    const range = `${AURATUS_CONFIG.SHEETS.CARDS_CRM}!A2:D`;
    const url = `${this.baseURL}/${AURATUS_CONFIG.SHEET_ID}/values/${range}`;
    const res = await fetch(url, { headers: this.headers(token) });
    const data = await res.json();
    if (!data.values) return;
    const rowIndex = data.values.findIndex(r => r[0] === card_id);
    if (rowIndex === -1) return;
    const updateRange = `${AURATUS_CONFIG.SHEETS.CARDS_CRM}!A${rowIndex + 2}:D${rowIndex + 2}`;
    const updateURL = `${this.baseURL}/${AURATUS_CONFIG.SHEET_ID}/values/${updateRange}?valueInputOption=RAW`;
    await fetch(updateURL, {
      method: 'PUT',
      headers: this.headers(token),
      body: JSON.stringify({
        range: updateRange,
        values: [[card_id, empresa_id, pessoa_id, new Date().toISOString()]]
      })
    });
  },

  // ---- PESSOAS_EMPRESAS (relação muitos-para-muitos) ----

  async getAllPessoaEmpresas(token) {
    const range = `${AURATUS_CONFIG.SHEETS.PESSOAS_EMPRESAS}!A2:B`;
    const url = `${this.baseURL}/${AURATUS_CONFIG.SHEET_ID}/values/${range}`;
    const res = await fetch(url, { headers: this.headers(token) });
    const data = await res.json();
    if (!data.values) return [];
    return data.values
      .filter(r => r[0])
      .map(r => ({ pessoa_id: r[0], empresa_id: r[1] || '' }));
  },

  async getPessoaEmpresas(token, pessoa_id) {
    const todas = await this.getAllPessoaEmpresas(token);
    return todas.filter(pe => pe.pessoa_id === pessoa_id).map(pe => pe.empresa_id);
  },

  async addPessoaEmpresa(token, pessoa_id, empresa_id) {
    const todas = await this.getAllPessoaEmpresas(token);
    const existe = todas.some(pe => pe.pessoa_id === pessoa_id && pe.empresa_id === empresa_id);
    if (existe) return;
    await this._appendRow(token, AURATUS_CONFIG.SHEETS.PESSOAS_EMPRESAS, [pessoa_id, empresa_id]);
  },

  // ---- DESASSOCIAR ----

  async deleteCardAssociacao(token, card_id) {
    const range = `${AURATUS_CONFIG.SHEETS.CARDS_CRM}!A2:D`;
    const url = `${this.baseURL}/${AURATUS_CONFIG.SHEET_ID}/values/${range}`;
    const res = await fetch(url, { headers: this.headers(token) });
    const data = await res.json();
    if (!data.values) return;
    const rowIndex = data.values.findIndex(r => r[0] === card_id);
    if (rowIndex === -1) return;
    const gid = await this._getSheetGid(token, AURATUS_CONFIG.SHEETS.CARDS_CRM);
    if (gid == null) return;
    // rowIndex 0 = 1ª linha de dados (linha 2 da folha) = índice 1 (0-based, inclui cabeçalho)
    const startIndex = rowIndex + 1;
    const batchURL = `${this.baseURL}/${AURATUS_CONFIG.SHEET_ID}:batchUpdate`;
    await fetch(batchURL, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: { sheetId: gid, dimension: 'ROWS', startIndex, endIndex: startIndex + 1 }
          }
        }]
      })
    });
  },

  async _getSheetGid(token, title) {
    if (!this._gids) {
      const url = `${this.baseURL}/${AURATUS_CONFIG.SHEET_ID}?fields=sheets(properties(sheetId,title))`;
      const res = await fetch(url, { headers: this.headers(token) });
      const data = await res.json();
      this._gids = {};
      (data.sheets || []).forEach(s => {
        this._gids[s.properties.title] = s.properties.sheetId;
      });
    }
    return this._gids[title];
  },

  // ---- UTILITÁRIO ----

  async _appendRow(token, sheet, row) {
    const range = `${sheet}!A:A`;
    const url = `${this.baseURL}/${AURATUS_CONFIG.SHEET_ID}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
    await fetch(url, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify({ values: [row] })
    });
  }
};
