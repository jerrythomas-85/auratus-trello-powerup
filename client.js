// ============================================================
// CLIENT.JS — Inicialização do Power-Up Trello
// ============================================================

// Ícone "pessoa com envelope" em SVG (data URI). Geramos uma versão escura
// (para fundos claros) e uma branca (para fundos escuros, ex.: header do board).
function iconeContacto(cor) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="3 2 21 21" fill="none" stroke="' + cor + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" />'
    + '<path d="M6 21v-2a4 4 0 0 1 4 -4h1.5" />'
    + '<path d="M15 18a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />'
    + '<path d="M20.2 20.2l1.8 1.8" />'
    + '</svg>';
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

const ICON_DARK = iconeContacto('#42526e');
const ICON_LIGHT = iconeContacto('#ffffff');

function abrirPesquisa(t) {
  return t.modal({
    title: 'Ver CRM',
    url: './search.html',
    fullscreen: true
  });
}

// Cache em memória das associações + empresas, partilhado por todos os badges
// do board. Evita uma ida à Sheet por card; uma só por abertura do board.
const CRM_CACHE_TTL = 5 * 60 * 1000;
let _crmCache = { ts: 0, byCard: null, empresasById: null, inflight: null };

function loadCrmData(token) {
  const fresco = _crmCache.byCard && (Date.now() - _crmCache.ts) < CRM_CACHE_TTL;
  if (fresco) return Promise.resolve(_crmCache);
  if (_crmCache.inflight) return _crmCache.inflight;
  _crmCache.inflight = Promise.all([
    SheetsAPI.getAllCardAssociacoes(token),
    SheetsAPI.getEmpresas(token)
  ]).then(function(res) {
    const byCard = {};
    res[0].forEach(function(a) { byCard[a.card_id] = a; });
    const empresasById = {};
    res[1].forEach(function(e) { empresasById[e.empresa_id] = e; });
    _crmCache = { ts: Date.now(), byCard: byCard, empresasById: empresasById, inflight: null };
    return _crmCache;
  }).catch(function(err) {
    _crmCache.inflight = null;
    throw err;
  });
  return _crmCache.inflight;
}

// Token sem qualquer interação (nunca login()): memória/cookie ou refresh silencioso.
function tokenSilencioso(t) {
  Auth.init(t);
  const existente = Auth.getToken();
  if (existente) return Promise.resolve(existente);
  return Auth.refreshSilently();
}

// Lê o badge guardado localmente no card (t.set feito ao associar). Se não existir
// (ex.: card criado por automação que só escreveu em CARDS_CRM), materializa-o a
// partir da Sheet — em silêncio — e grava-o localmente para os próximos renders.
function crmBadgeEmpresa(t) {
  return t.get('card', 'shared', 'crmBadge').then(function(badge) {
    if (badge && badge.empresa) {
      return [{ text: badge.empresa.toUpperCase(), color: badge.cor || 'blue' }];
    }
    return materializarBadge(t);
  });
}

function materializarBadge(t) {
  return tokenSilencioso(t).then(function(token) {
    if (!token) return [];
    return Promise.all([t.card('id'), loadCrmData(token)]).then(function(res) {
      const assoc = res[1].byCard[res[0].id];
      if (!assoc || !assoc.empresa_id) return [];
      const empresa = res[1].empresasById[assoc.empresa_id];
      if (!empresa || !empresa.nome) return [];
      const novo = { pessoa: '', empresa: empresa.nome.toUpperCase(), cor: empresa.cor || 'blue' };
      return t.set('card', 'shared', 'crmBadge', novo)
        .catch(function() {})
        .then(function() {
          return [{ text: novo.empresa, color: novo.cor }];
        });
    });
  }).catch(function() {
    return [];
  });
}

TrelloPowerUp.initialize({
  'card-buttons': function(t, options) {
    return [{
      icon: ICON_DARK,
      text: 'CRM Auratus',
      callback: function(t) {
        return t.popup({
          title: 'CRM Auratus',
          url: './sidebar.html',
          height: 600
        });
      }
    }];
  },

  'board-buttons': function(t, options) {
    return [{
      icon: { dark: ICON_LIGHT, light: ICON_DARK },
      text: 'Ver CRM',
      callback: abrirPesquisa
    }];
  },

  'card-back-section': function(t, options) {
    return {
      title: 'CRM Auratus',
      icon: ICON_DARK,
      content: {
        type: 'iframe',
        url: t.signUrl('./card-section.html'),
        height: 80
      },
      action: {
        text: '👁️ Ver CRM',
        callback: abrirPesquisa
      }
    };
  },

  'card-badges': function(t, options) {
    return crmBadgeEmpresa(t);
  },

  'card-detail-badges': function(t, options) {
    return crmBadgeEmpresa(t);
  }
});
