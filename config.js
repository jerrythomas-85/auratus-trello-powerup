const AURATUS_CONFIG = {
  // Google OAuth 2.0
  CLIENT_ID: '158811393234-gv7tfjs8j122h1q3dg919q6dikupe2gk.apps.googleusercontent.com',
  REDIRECT_URI: 'https://jerrythomas-85.github.io/auratus-trello-powerup/auth-callback.html',
  SCOPES: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly'
  ].join(' '),

  // Google Sheets
  SHEET_ID: '1nS-AnJ4xvAqCQhYED4X1fc5dXgeZlT9_z6Xmji6c-9E',
  SHEETS: {
    EMPRESAS: 'EMPRESAS',
    PESSOAS: 'PESSOAS',
    CARDS_CRM: 'CARDS_CRM',
    PESSOAS_EMPRESAS: 'PESSOAS_EMPRESAS'
  },

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
