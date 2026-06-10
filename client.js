// ============================================================
// CLIENT.JS — Inicialização do Power-Up Trello
// ============================================================

// Ícone "pessoa com envelope" em SVG (data URI). Geramos uma versão escura
// (para fundos claros) e uma branca (para fundos escuros, ex.: header do board).
function iconeContacto(cor) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="' + cor + '">'
    + '<circle cx="12" cy="4" r="3"/>'
    + '<path d="M5.5 11c0-3.1 2.6-4.3 6.5-4.3s6.5 1.2 6.5 4.3z"/>'
    + '<path fill-rule="evenodd" d="M2.5 13a1.2 1.2 0 0 1 1.2-1.2h16.6a1.2 1.2 0 0 1 1.2 1.2v8a1.2 1.2 0 0 1-1.2 1.2H3.7A1.2 1.2 0 0 1 2.5 21zM4 13.4 12 17.2l8-3.8v1.1L12 18.3 4 14.5z"/>'
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
