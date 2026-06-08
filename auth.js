// ============================================================
// AUTH.JS — Fluxo OAuth 2.0 com Google
// ============================================================

const Auth = {

  TOKEN_KEY: 'auratus_google_token',
  TOKEN_EXPIRY_KEY: 'auratus_google_token_expiry',

  _token: null,
  _expiry: null,

  getToken() {
    // Primeiro verifica memória
    if (this._token && this._expiry && Date.now() < this._expiry) {
      return this._token;
    }
    // Depois tenta localStorage
    try {
      const token = localStorage.getItem(this.TOKEN_KEY);
      const expiry = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
      if (token && expiry && Date.now() < parseInt(expiry)) {
        this._token = token;
        this._expiry = parseInt(expiry);
        return token;
      }
    } catch(e) {}
    return null;
  },

  saveToken(token, expiry) {
    this._token = token;
    this._expiry = expiry;
    try {
      localStorage.setItem(this.TOKEN_KEY, token);
      localStorage.setItem(this.TOKEN_EXPIRY_KEY, String(expiry));
    } catch(e) {}
  },

  clearToken() {
    this._token = null;
    this._expiry = null;
    try {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
    } catch(e) {}
  },

  login() {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        client_id: AURATUS_CONFIG.CLIENT_ID,
        redirect_uri: AURATUS_CONFIG.REDIRECT_URI,
        response_type: 'token',
        scope: AURATUS_CONFIG.SCOPES,
        prompt: 'consent'
      });

      const authURL = 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
      const popup = window.open(authURL, 'oauth', 'width=500,height=600');

      if (!popup) {
        reject(new Error('Popup bloqueado. Permite popups para este site.'));
        return;
      }

      // Recebe token via postMessage
      const messageHandler = (event) => {
        if (!event.data || event.data.type !== 'OAUTH_TOKEN') return;
        window.removeEventListener('message', messageHandler);
        clearInterval(pollInterval);
        this.saveToken(event.data.token, event.data.expiry);
        resolve(event.data.token);
      };
      window.addEventListener('message', messageHandler);

      // Fallback: polling quando popup fecha
      const pollInterval = setInterval(() => {
        try {
          if (popup.closed) {
            clearInterval(pollInterval);
            window.removeEventListener('message', messageHandler);
            const token = this.getToken();
            if (token) {
              resolve(token);
            } else {
              reject(new Error('Autenticação cancelada ou falhou.'));
            }
          }
        } catch(e) {}
      }, 500);
    });
  },

  async ensureToken() {
    const token = this.getToken();
    if (token) return token;
    return await this.login();
  }
};
