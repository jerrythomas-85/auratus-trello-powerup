// ============================================================
// CLIENT.JS — Inicialização do Power-Up Trello
// ============================================================

// Ícone "pessoa com envelope" em SVG (data URI). Geramos uma versão escura
// (para fundos claros) e uma branca (para fundos escuros, ex.: header do board).
function iconeContacto(cor) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="' + cor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
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

// Lê o badge guardado localmente no card (t.set feito ao associar).
// Rápido: sem OAuth e sem ir à Google Sheet. Mostra só o nome da empresa.
function crmBadgeEmpresa(t) {
  return t.get('card', 'shared', 'crmBadge').then(function(badge) {
    if (!badge || !badge.empresa) return [];
    return [{ text: badge.empresa.toUpperCase(), color: badge.cor || 'blue' }];
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
