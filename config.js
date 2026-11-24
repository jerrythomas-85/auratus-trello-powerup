const AURATUS_CONFIG = {
  // Copa (plataforma interna da Auratus): desde 24 nov 2026 o CRM grava na Copa em vez da folha
  // TRELLO_AI_WORKSPACE. A chave é a publicável do Supabase (pública por natureza): as permissões
  // vivem na base de dados (RLS) e cada pessoa entra com a sua conta da Copa (email + código + 2FA).
  COPA_URL: 'https://copa.auratus.pt',
  SUPABASE_URL: 'https://relsouxxqvmfpngsukcj.supabase.co',
  SUPABASE_KEY: 'sb_publishable_Kj0ak9Zo7vwB8m2OrVPe7w_iLeg6qbU',

  // Trello
  TRELLO_API_KEY: 'd8bf5f0feecb84127550bcccbd6272bb'
};

// Paleta de cores de badge suportadas pelo Trello (partilhada entre sidebar e pesquisa).
const TRELLO_CORES = [
  { nome: 'green', hex: '#61bd4f' },
  { nome: 'yellow', hex: '#f2d600' },
  { nome: 'orange', hex: '#ff9f1a' },
  { nome: 'red', hex: '#eb5a46' },
  { nome: 'purple', hex: '#c377e0' },
  { nome: 'blue', hex: '#0079bf' },
  { nome: 'sky', hex: '#00c2e0' },
  { nome: 'lime', hex: '#51e898' },
  { nome: 'pink', hex: '#ff78cb' },
  { nome: 'black', hex: '#344563' }
];

function hexDaCor(nome) {
  const c = TRELLO_CORES.find(x => x.nome === nome);
  return c ? c.hex : '#42526e';
}

// Distritos de Portugal continental + Açores + Madeira + Estrangeiro.
const DISTRITOS = [
  'Aveiro', 'Beja', 'Braga', 'Bragança', 'Castelo Branco', 'Coimbra', 'Évora',
  'Faro', 'Guarda', 'Leiria', 'Lisboa', 'Portalegre', 'Porto', 'Santarém',
  'Setúbal', 'Viana do Castelo', 'Vila Real', 'Viseu',
  'Açores', 'Madeira', 'Estrangeiro'
];

// Opções <option> para um <select> de distrito, com o valor atual selecionado.
function distritoOptionsHTML(selecionado) {
  return DISTRITOS.map(d => `<option value="${d}"${d === selecionado ? ' selected' : ''}>${d}</option>`).join('');
}
