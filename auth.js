const Auth = {

  _token: null,
  _expiry: null,
  _refresh: null,
  _t: null,

  // Recebe o objeto Trello (t) para guardar o refresh token sincronizado na conta.
  init(t) { this._t = t; },

  getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  },

  setCookie(name, value, maxAge) {
    document.cookie = `${name}=${value};max-age=${maxAge};path=/;SameSite=None;Secure`;
  },

  // Access token válido (com margem de 60s) — memória ou cookie.
  getToken() {
    if (this._token && this._expiry && Date.now() < this._expiry - 60000) {
      return this._token;
    }
    const token = this.getCookie('auratus_token');
    const expiry = this.getCookie('auratus_expiry');
    if (token && expiry && Date.now() < parseInt(expiry) - 60000) {
      this._token = token;
      this._expiry = parseInt(expiry);
      return token;
    }
    return null;
  },

  async getRefreshToken() {
    if (this._refresh) return this._refresh;
    const c = this.getCookie('auratus_refresh');
    if (c) { this._refresh = c; return c; }
    if (this._t) {
      try {
        const r = await this._t.get('member', 'private', 'auratusRefresh');
        if (r) { this._refresh = r; return r; }
      } catch (e) {}
    }
    return null;
  },

  async saveRefreshToken(refresh) {
    if (!refresh) return;
    this._refresh = refresh;
    this.setCookie('auratus_refresh', refresh, 60 * 60 * 24 * 365);
    if (this._t) {
      try { await this._t.set('member', 'private', 'auratusRefresh', refresh); } catch (e) {}
    }
  },

  _guardarAccessToken(accessToken, expiresIn) {
    const maxAge = parseInt(expiresIn) || 3600;
    const expiry = Date.now() + maxAge * 1000;
    this._token = accessToken;
    this._expiry = expiry;
    this.setCookie('auratus_token', accessToken, maxAge);
    this.setCookie('auratus_expiry', expiry, maxAge);
  },

  // Renova o access token a partir do refresh token, sem qualquer interação.
  async refreshSilently() {
    const refresh = await this.getRefreshToken();
    if (!refresh) return null;
    try {
      const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh })
      });
      const data = await res.json();
      if (!res.ok || !data.access_token) return null;
      this._guardarAccessToken(data.access_token, data.expires_in);
      return data.access_token;
    } catch (e) {
      return null;
    }
  },

  // Login com popup (fluxo de código + acesso offline). Só é preciso uma vez.
  login() {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        client_id: AURATUS_CONFIG.CLIENT_ID,
        redirect_uri: AURATUS_CONFIG.REDIRECT_URI,
        response_type: 'code',
        access_type: 'offline',
        prompt: 'consent',
        scope: AURATUS_CONFIG.SCOPES
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
            // auth-callback.html escreveu os cookies (token/expiry/refresh).
            setTimeout(async () => {
              const refresh = this.getCookie('auratus_refresh');
              if (refresh) await this.saveRefreshToken(refresh);
              const token = this.getToken();
              if (token) resolve(token);
              else reject(new Error('Autenticação cancelada ou falhou.'));
            }, 400);
          }
        } catch (e) {}
      }, 500);
    });
  },

  async ensureToken() {
    const token = this.getToken();
    if (token) return token;
    const refreshed = await this.refreshSilently();
    if (refreshed) return refreshed;
    return await this.login();
  }
};
