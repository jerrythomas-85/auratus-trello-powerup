// ============================================================
// AUTH.JS — Entrar com a conta da Copa (desde 24 nov 2026)
// ============================================================
// Antes: conta Google + folha TRELLO_AI_WORKSPACE. Agora: a mesma conta da Copa (copa.auratus.pt):
// email @auratus.pt, código enviado por email e código da app de autenticação (2FA obrigatório).
// A sessão fica guardada neste browser (dentro do Trello) e renova-se sozinha; entra-se uma vez por browser.
// O "token" que as outras partes do Power-Up recebem é só um sinal de que há sessão: os pedidos à Copa
// usam o cliente Supabase partilhado (Auth.supabase), com as regras de acesso da Copa (RLS).

function _escAuth(v) {
  return String(v || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const Auth = {

  _t: null,
  _espera: null,

  supabase: supabase.createClient(AURATUS_CONFIG.SUPABASE_URL, AURATUS_CONFIG.SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'copa-crm-powerup' }
  }),

  init(t) { this._t = t; },

  // Sessão com os dois fatores verificados (aal2) — sem isso a Copa não devolve nada.
  async _sessaoValida() {
    const { data } = await this.supabase.auth.getSession();
    if (!data.session) return null;
    const { data: nivel } = await this.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!nivel || nivel.currentLevel !== 'aal2') return null;
    return data.session.access_token;
  },

  // Compatibilidade: devolve logo o que houver (sem pedidos à rede).
  getToken() { return null; },

  // Sem qualquer interação: sessão guardada (renovada se preciso) ou null.
  async refreshSilently() {
    try { return await this._sessaoValida(); } catch (e) { return null; }
  },

  // Sessão pronta a usar; se não houver, mostra o formulário de entrada e espera.
  async ensureToken() {
    const token = await this.refreshSilently();
    if (token) return token;
    if (!this._espera) {
      this._espera = new Promise(resolve => this._mostrarEntrada(resolve)).finally(() => { this._espera = null; });
    }
    return this._espera;
  },

  async sair() {
    await this.supabase.auth.signOut();
  },

  // ---- Formulário de entrada ----

  _caixa() {
    let caixa = document.getElementById('copa-entrar');
    if (caixa) return caixa;
    caixa = document.createElement('div');
    caixa.id = 'copa-entrar';
    const painel = document.getElementById('crm-panel');
    if (painel) {
      painel.innerHTML = '';
      painel.appendChild(caixa);
    } else {
      caixa.className = 'copa-entrar-sobre';
      document.body.appendChild(caixa);
    }
    return caixa;
  },

  _fechar() {
    const caixa = document.getElementById('copa-entrar');
    if (caixa) caixa.remove();
  },

  // No painel pequeno dentro do cartão não cabe o formulário: um botão abre a janela do CRM (onde se entra)
  // e este painel fica à espera da sessão (partilhada por todas as janelas do Power-Up neste browser).
  _mostrarEntradaEmbutida(resolve) {
    const caixa = this._caixa();
    caixa.innerHTML = `
      <div class="section copa-entrar">
        <p class="hint">O CRM agora vive na Copa. Entra uma vez com a tua conta da Copa.</p>
        <div class="form-actions"><button id="copa-abrir" class="btn-primary">Entrar na Copa</button></div>
      </div>`;
    document.getElementById('copa-abrir').addEventListener('click', () => {
      if (this._t) this._t.modal({ title: 'Entrar na Copa', url: './sidebar.html', height: 560, fullscreen: false });
    });
    const espera = setInterval(async () => {
      const token = await this.refreshSilently();
      if (!token) return;
      clearInterval(espera);
      this._fechar();
      resolve(token);
    }, 2000);
  },

  _mostrarEntrada(resolve) {
    if (window.CRM_EMBEDDED) return this._mostrarEntradaEmbutida(resolve);
    const caixa = this._caixa();
    let email = '';

    const passoEmail = (erro) => {
      caixa.innerHTML = `
        <div class="section copa-entrar">
          <h2>Entrar na Copa</h2>
          <p class="sub">O CRM agora vive na Copa. Entra com a tua conta da Copa (só é preciso uma vez neste browser).</p>
          <div class="form-group"><label>Email</label>
            <input type="email" id="copa-email" placeholder="nome@auratus.pt" value="${_escAuth(email)}" autocomplete="email" /></div>
          <span class="field-error-msg">${_escAuth(erro)}</span>
          <div class="form-actions"><button id="copa-enviar" class="btn-primary">Enviar código</button></div>
        </div>`;
      const enviar = async () => {
        email = document.getElementById('copa-email').value.trim().toLowerCase();
        if (!email.endsWith('@auratus.pt')) return passoEmail('Usa o teu email @auratus.pt.');
        document.getElementById('copa-enviar').disabled = true;
        // shouldCreateUser: false — só entra quem já tem conta na Copa (igual ao ecrã de entrada da Copa).
        await this.supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
        passoCodigo();
      };
      document.getElementById('copa-enviar').addEventListener('click', enviar);
      document.getElementById('copa-email').addEventListener('keydown', e => { if (e.key === 'Enter') enviar(); });
      document.getElementById('copa-email').focus();
    };

    const passoCodigo = (erro) => {
      caixa.innerHTML = `
        <div class="section copa-entrar">
          <h2>Código do email</h2>
          <p class="sub">Se ${_escAuth(email)} tiver conta na Copa, recebeu um código. Escreve-o aqui.</p>
          <div class="form-group"><label>Código</label>
            <input type="text" id="copa-codigo" inputmode="numeric" autocomplete="one-time-code" /></div>
          <span class="field-error-msg">${_escAuth(erro)}</span>
          <div class="form-actions">
            <button id="copa-voltar" class="btn-secondary">Voltar</button>
            <button id="copa-confirmar" class="btn-primary">Confirmar</button>
          </div>
        </div>`;
      const confirmar = async () => {
        document.getElementById('copa-confirmar').disabled = true;
        const token = document.getElementById('copa-codigo').value.trim();
        const { error } = await this.supabase.auth.verifyOtp({ email, token, type: 'email' });
        if (error) return passoCodigo('Código inválido ou expirado. Confirma ou volta atrás e pede outro.');
        passoDoisFatores();
      };
      document.getElementById('copa-voltar').addEventListener('click', () => passoEmail());
      document.getElementById('copa-confirmar').addEventListener('click', confirmar);
      document.getElementById('copa-codigo').addEventListener('keydown', e => { if (e.key === 'Enter') confirmar(); });
      document.getElementById('copa-codigo').focus();
    };

    const passoDoisFatores = async (erro) => {
      const { data: fatores } = await this.supabase.auth.mfa.listFactors();
      const fator = ((fatores && fatores.totp) || []).find(f => f.status === 'verified');
      if (!fator) {
        await this.supabase.auth.signOut();
        caixa.innerHTML = `
          <div class="section copa-entrar">
            <h2>Falta a app de autenticação</h2>
            <p class="sub">Entra primeiro em <a href="${AURATUS_CONFIG.COPA_URL}" target="_blank" rel="noreferrer">copa.auratus.pt</a>
            para configurar a app de autenticação (dois fatores). Depois volta aqui.</p>
            <div class="form-actions"><button id="copa-recomecar" class="btn-primary">Já configurei</button></div>
          </div>`;
        document.getElementById('copa-recomecar').addEventListener('click', () => passoEmail());
        return;
      }
      caixa.innerHTML = `
        <div class="section copa-entrar">
          <h2>App de autenticação</h2>
          <p class="sub">Escreve o código de 6 números da app Palavras-passe do Mac (ou da tua app de autenticação), o mesmo que usas na Copa.</p>
          <div class="form-group"><label>Código da app</label>
            <input type="text" id="copa-totp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" /></div>
          <span class="field-error-msg">${_escAuth(erro)}</span>
          <div class="form-actions"><button id="copa-verificar" class="btn-primary">Entrar</button></div>
        </div>`;
      const verificar = async () => {
        document.getElementById('copa-verificar').disabled = true;
        const code = document.getElementById('copa-totp').value.replace(/\s/g, '');
        const { error } = await this.supabase.auth.mfa.challengeAndVerify({ factorId: fator.id, code });
        if (error) return passoDoisFatores('Código errado. Espera pelo seguinte e tenta outra vez.');
        const token = await this._sessaoValida();
        if (!token) return passoDoisFatores('Não foi possível entrar. Tenta outra vez.');
        this._fechar();
        resolve(token);
      };
      document.getElementById('copa-verificar').addEventListener('click', verificar);
      document.getElementById('copa-totp').addEventListener('keydown', e => { if (e.key === 'Enter') verificar(); });
      document.getElementById('copa-totp').focus();
    };

    // Já com código do email mas sem o segundo fator (ex.: fechou a janela a meio)?
    this.supabase.auth.getSession().then(({ data }) => {
      if (data.session) passoDoisFatores();
      else passoEmail();
    });
  }
};
