// ============================================================
// CLIENT.JS — Inicialização do Power-Up Trello
// ============================================================

// Ícone "pessoa com envelope" em SVG (data URI). Geramos uma versão escura
// (para fundos claros) e uma branca (para fundos escuros, ex.: header do board).
function iconeContacto(cor) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="' + cor + '">'
    + '<circle cx="12" cy="4" r="2.4"/>'
    + '<path d="M7.5 10c0-2.7 2-3.8 4.5-3.8s4.5 1.1 4.5 3.8z"/>'
    + '<path fill-rule="evenodd" d="M4 13a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM5.2 13.3 12 16.5l6.8-3.2v.9L12 17.4 5.2 14.2z"/>'
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
      icon: { dark: ICON_DARK, light: ICON_LIGHT },
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
