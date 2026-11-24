// ============================================================
// SHEETS.JS — Dados do CRM, agora na Copa (desde 24 nov 2026)
// ============================================================
// O nome (SheetsAPI) e as funções ficaram iguais para o resto do Power-Up não mudar, mas já não há
// folha: tudo se lê e grava na Copa (Supabase), com a sessão de quem está a usar (Auth.supabase).
// As regras de acesso são as da Copa: toda a equipa vê, cria e altera empresas, pessoas, ligações,
// e cartões; apagar empresas e pessoas só administradores; num cliente ARD, o nome e as notas só um administrador muda; um cliente ARD nunca se apaga.
// As avenças gerem-se na Copa (ARD): aqui só se leem.
// Ids: os da Copa (uuid). O parâmetro "token" ficou só por compatibilidade.
//
// Correspondência com a Copa: empresa = clientes; pessoa = contactos (empresa_id = empresa principal);
// pessoa ↔ empresa = contactos_empresas; associação de cartão = crm_cartoes. Os eventos saíram do Power-Up
// a 24 nov 2026 (decisão do Jerry): estão no calendário e no cronograma das empresas na Copa.

const SheetsAPI = {

  get db() { return Auth.supabase; },

  // Traduz os erros da base de dados para português simples.
  _erro(error, acao) {
    const msg = (error && error.message) || '';
    if (/row-level security|permission denied|JWT|not authorized/i.test(msg)) {
      return new Error(`Sem permissão para ${acao}. Se a sessão expirou, fecha e volta a abrir o CRM.`);
    }
    return new Error(msg || `Não foi possível ${acao}.`);
  },

  async _ler(pedido, acao) {
    const { data, error } = await pedido;
    if (error) throw this._erro(error, acao);
    return data || [];
  },

  _v(x) { const s = (x === undefined || x === null) ? '' : String(x).trim(); return s || null; },

  _normalizar(t) {
    return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  },

  _hoje() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date());
  },

  // A avença que conta: a ativa em vigor hoje; senão a ativa mais recente (igual a avencaAtual na Copa).
  _avencaAtual(avencas) {
    const hoje = this._hoje();
    const ordenadas = (avencas || []).slice().sort((a, b) => String(b.data_inicio).localeCompare(String(a.data_inicio)));
    return ordenadas.find(a => a.estado === 'ativa' && a.data_inicio <= hoje) ||
           ordenadas.find(a => a.estado === 'ativa') || null;
  },

  // ---- EMPRESAS ----

  _mapEmpresa(c) {
    const av = this._avencaAtual(c.avencas);
    return {
      empresa_id: c.id,
      nome: c.nome || '',
      localizacao: c.localidade || '',
      setor: c.setor || '',
      plano: av ? av.plano : '',          // só leitura: vem da avença na Copa
      data_inicio: av ? av.data_inicio : '',
      email: c.email || '',
      telefone: c.telefone || '',
      notas: c.notas || '',
      cor: c.cor || '',
      distrito: c.distrito || ''
    };
  },

  async getEmpresas(token) {
    const linhas = await this._ler(
      this.db.from('clientes')
        .select('id, nome, localidade, distrito, setor, email, telefone, notas, cor, avencas(plano, data_inicio, estado)')
        .order('nome').range(0, 4999),
      'ler as empresas');
    return linhas.map(c => this._mapEmpresa(c));
  },

  _dadosEmpresa(empresa) {
    const setor = ['Restaurante', 'Outro'].includes(empresa.setor) ? empresa.setor : null;
    const cor = TRELLO_CORES.some(c => c.nome === empresa.cor) ? empresa.cor : null;
    return {
      localidade: this._v(empresa.localizacao),
      distrito: this._v(empresa.distrito),
      setor,
      email: this._v(empresa.email),
      telefone: this._v(empresa.telefone),
      cor
    };
  },

  async createEmpresa(token, empresa) {
    const nome = this._v(empresa.nome);
    if (!nome) throw new Error('Escreve o nome da empresa.');
    // Como na Copa: não se cria outra empresa com o mesmo nome (sem acentos nem maiúsculas).
    const existentes = await this._ler(this.db.from('clientes').select('nome').range(0, 4999), 'ler as empresas');
    const igual = existentes.find(c => this._normalizar(c.nome) === this._normalizar(nome));
    if (igual) throw new Error(`Já existe a empresa "${igual.nome}". Escolhe-a na pesquisa em vez de criar outra.`);
    const { data, error } = await this.db.from('clientes')
      .insert({ nome, notas: this._v(empresa.notas), ...this._dadosEmpresa(empresa) })
      .select('id').single();
    if (error || !data) throw this._erro(error, 'criar a empresa');
    return data.id;
  },

  async updateEmpresa(token, empresa_id, empresa) {
    const dados = { nome: this._v(empresa.nome), notas: this._v(empresa.notas), ...this._dadosEmpresa(empresa) };
    if (!dados.nome) throw new Error('Escreve o nome da empresa.');
    const { data, error } = await this.db.from('clientes').update(dados).eq('id', empresa_id).select('id');
    if (error) throw this._erro(error, 'guardar a empresa');
    if (!data || !data.length) throw new Error('Não foi possível guardar a empresa.');
  },

  // ---- PESSOAS ----

  _mapPessoa(k) {
    return {
      pessoa_id: k.id,
      empresa_id: k.cliente_id || '',
      nome: k.nome || '',
      apelido: k.apelido || '',
      cargo: k.cargo || '',
      funcao: k.funcao || '',
      email: k.email || '',
      telemovel: k.telemovel || ''
    };
  },

  async getPessoas(token, empresa_id = null) {
    let pedido = this.db.from('contactos')
      .select('id, cliente_id, nome, apelido, cargo, funcao, email, telemovel')
      .order('nome').range(0, 9999);
    if (empresa_id) pedido = pedido.eq('cliente_id', empresa_id);
    const linhas = await this._ler(pedido, 'ler as pessoas');
    return linhas.map(k => this._mapPessoa(k));
  },

  _dadosPessoa(pessoa) {
    return {
      nome: this._v(pessoa.nome),
      apelido: this._v(pessoa.apelido),
      cargo: ['Gerência', 'Colaborador'].includes(pessoa.cargo) ? pessoa.cargo : null,
      funcao: this._v(pessoa.funcao),
      email: this._v(pessoa.email),
      telemovel: this._v(pessoa.telemovel)
    };
  },

  async updatePessoa(token, pessoa_id, pessoa) {
    const dados = this._dadosPessoa(pessoa);
    if (!dados.nome) throw new Error('Escreve o nome da pessoa.');
    // Empresa principal: a que vier; se não vier, fica a que está (a ligação nasce sozinha na Copa).
    if (pessoa.empresa_id) dados.cliente_id = pessoa.empresa_id;
    const { data, error } = await this.db.from('contactos').update(dados).eq('id', pessoa_id).select('id');
    if (error) throw this._erro(error, 'guardar a pessoa');
    if (!data || !data.length) throw new Error('Não foi possível guardar a pessoa.');
  },

  async createPessoa(token, pessoa) {
    const dados = this._dadosPessoa(pessoa);
    if (!dados.nome) throw new Error('Escreve o nome da pessoa.');
    if (!pessoa.empresa_id) throw new Error('Escolhe a empresa da pessoa.');
    const { data, error } = await this.db.from('contactos')
      .insert({ ...dados, cliente_id: pessoa.empresa_id })
      .select('id').single();
    if (error || !data) throw this._erro(error, 'criar a pessoa');
    return data.id;
  },

  // ---- CARTÕES ASSOCIADOS ----

  _mapCartao(r) {
    return { card_id: r.cartao_id, empresa_id: r.cliente_id || '', pessoa_id: r.contacto_id || '', data_associacao: r.associado_em || '' };
  },

  async getAllCardAssociacoes(token) {
    const linhas = await this._ler(
      this.db.from('crm_cartoes').select('cartao_id, cliente_id, contacto_id, associado_em').range(0, 9999),
      'ler as associações dos cartões');
    return linhas.map(r => this._mapCartao(r));
  },

  async getCardAssociacao(token, card_id) {
    const { data, error } = await this.db.from('crm_cartoes')
      .select('cartao_id, cliente_id, contacto_id, associado_em').eq('cartao_id', card_id).maybeSingle();
    if (error) throw this._erro(error, 'ler a associação do cartão');
    return data ? this._mapCartao(data) : null;
  },

  // nome_cartao (opcional): o nome do cartão no Trello, para a Copa o mostrar logo (senão lê-o de madrugada).
  async saveCardAssociacao(token, card_id, empresa_id, pessoa_id, nome_cartao) {
    const linha = {
      cartao_id: card_id,
      cliente_id: empresa_id,
      contacto_id: pessoa_id || null,
      associado_em: new Date().toISOString()
    };
    if (nome_cartao) linha.nome = nome_cartao;
    const { error } = await this.db.from('crm_cartoes').upsert(linha, { onConflict: 'cartao_id' });
    if (error) throw this._erro(error, 'associar o cartão');
  },

  async deleteCardAssociacao(token, card_id) {
    const { error } = await this.db.from('crm_cartoes').delete().eq('cartao_id', card_id);
    if (error) throw this._erro(error, 'desassociar o cartão');
  },

  // ---- PESSOA ↔ EMPRESA ----

  async getAllPessoaEmpresas(token) {
    const linhas = await this._ler(
      this.db.from('contactos_empresas').select('contacto_id, cliente_id').range(0, 9999),
      'ler as ligações entre pessoas e empresas');
    return linhas.map(r => ({ pessoa_id: r.contacto_id, empresa_id: r.cliente_id }));
  },

  async getPessoaEmpresas(token, pessoa_id) {
    const linhas = await this._ler(
      this.db.from('contactos_empresas').select('cliente_id').eq('contacto_id', pessoa_id),
      'ler as empresas da pessoa');
    return linhas.map(r => r.cliente_id);
  },

  async addPessoaEmpresa(token, pessoa_id, empresa_id) {
    const { error } = await this.db.from('contactos_empresas')
      .upsert({ contacto_id: pessoa_id, cliente_id: empresa_id }, { onConflict: 'contacto_id,cliente_id', ignoreDuplicates: true });
    if (error) throw this._erro(error, 'ligar a pessoa à empresa');
  },

  // Uma pessoa nunca fica sem empresa: se esta for a principal, passa a principal para outra antes;
  // se for a única, não se desliga (para a tirar de vez, apaga-se a pessoa).
  async removePessoaEmpresa(token, pessoa_id, empresa_id) {
    const [{ data: pessoa }, { data: ligacoes }] = await Promise.all([
      this.db.from('contactos').select('cliente_id').eq('id', pessoa_id).maybeSingle(),
      this.db.from('contactos_empresas').select('cliente_id').eq('contacto_id', pessoa_id)
    ]);
    const outras = (ligacoes || []).map(l => l.cliente_id).filter(id => id !== empresa_id);
    if (!outras.length) return;
    if (pessoa && pessoa.cliente_id === empresa_id) {
      const { error } = await this.db.from('contactos').update({ cliente_id: outras[0] }).eq('id', pessoa_id);
      if (error) throw this._erro(error, 'mudar a empresa principal');
    }
    const { error } = await this.db.from('contactos_empresas').delete().eq('contacto_id', pessoa_id).eq('cliente_id', empresa_id);
    if (error) throw this._erro(error, 'desligar a pessoa da empresa');
  },

  // ---- AVENÇAS (só leitura: criam-se e alteram-se na Copa → ARD) ----

  async getAllAvencas(token) {
    const linhas = await this._ler(
      this.db.from('avencas')
        .select('id, cliente_id, plano, valor, data_inicio, data_fim, renova, estado, contemplado, clientes(notas, link_pasta)')
        .order('data_inicio', { ascending: false }).range(0, 4999),
      'ler as avenças');
    return linhas.map(a => ({
      avenca_id: a.id,
      empresa_id: a.cliente_id,
      tipo: a.plano || '',
      valor: a.valor == null ? '' : String(a.valor),
      data_inicio: a.data_inicio || '',
      data_fim: a.data_fim || '',
      renova: a.renova ? 'SIM' : 'NÃO',
      estado: a.estado || '',
      notas: (a.clientes && a.clientes.notas) || '',
      link_pasta: (a.clientes && a.clientes.link_pasta) || '',
      contemplado: a.contemplado || ''
    }));
  },

  async addAvenca() {
    throw new Error('As avenças criam-se na Copa (ARD → Novo cliente, ou "Criar avença" na empresa do CRM).');
  },

  async updateAvenca() {
    throw new Error('As avenças alteram-se na Copa (ARD → ficha do cliente).');
  },

  // ---- APAGAR ----

  // Só administradores; um cliente ARD nunca se apaga. As pessoas que só estão nesta empresa vão com ela;
  // as que estão noutras ficam lá (função crm_apagar_empresa na Copa).
  async deleteEmpresa(token, empresa_id) {
    const { error } = await this.db.rpc('crm_apagar_empresa', { p_id: empresa_id });
    if (error) throw this._erro(error, 'apagar a empresa');
  },

  // Só administradores. Os cartões da pessoa ficam associados à empresa, sem pessoa.
  async deletePessoa(token, pessoa_id) {
    const { data, error } = await this.db.from('contactos').delete().eq('id', pessoa_id).select('id');
    if (error) throw this._erro(error, 'apagar a pessoa');
    if (!data || !data.length) throw new Error('Só um administrador pode apagar pessoas.');
  }
};
