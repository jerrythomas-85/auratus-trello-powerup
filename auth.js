const Auth = {

  _token: null,
  _expiry: null,

  getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  },

  getToken() {
    if (this._token && this._expiry && Date.now() < this._expiry) {
      return this._token;
    }
    const token = this.getCookie('auratus_token');
    const expiry = this.getCookie('auratus_expiry');
    if (token && expiry && Date.now() < parseInt(expiry)) {
      this._token = token;
      this._expiry = parseInt(expiry);
      return token;
    }
    return null;
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

      const pollInterval = setInterval(() => {
        try {
          if (popup.closed) {
            clearInterval(pollInterval);
            // Aguarda um momento para o cookie ser escrito
            setTimeout(() => {
              const token = this.getToken();
              if (token) {
                resolve(token);
              } else {
                reject(new Error('Autenticação cancelada ou falhou.'));
              }
            }, 300);
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
