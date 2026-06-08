// ============================================================
// AUTH.JS — Fluxo OAuth 2.0 com Google
// ============================================================

const Auth = {

  TOKEN_KEY: 'auratus_google_token',
  TOKEN_EXPIRY_KEY: 'auratus_google_token_expiry',

  getToken() {
    const token = localStorage.getItem(this.TOKEN_KEY);
    const expiry = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
    if (!token || !expiry) return null;
    if (Date.now() > parseInt(expiry)) {
      this.clearToken();
      return null;
    }
    return token;
  },

  saveToken(token, expiresIn = 3600) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.TOKEN_EXPIRY_KEY, Date.now() + (expiresIn * 1000));
  },

  clearToken() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
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

      // Polling: espera que o popup feche e verifica o localStorage
      const interval = setInterval(() => {
        try {
          if (popup.closed) {
            clearInterval(interval);
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
