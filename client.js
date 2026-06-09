// ============================================================
// CLIENT.JS — Inicialização do Power-Up Trello
// ============================================================

const ICON = 'https://cdn-icons-png.flaticon.com/512/561/561127.png';

function abrirPesquisa(t) {
  return t.modal({
    title: 'Pesquisa CRM',
    url: './search.html',
    fullscreen: true
  });
}

// Lê o badge guardado localmente no card (t.set feito ao associar).
// Rápido: sem OAuth e sem ir à Google Sheet.

// Frente do cartão (tile): só o nome da empresa.
function crmBadgeEmpresa(t) {
  return t.get('card', 'shared', 'crmBadge').then(function(badge) {
    if (!badge || !badge.empresa) return [];
    return [{ text: badge.empresa, color: 'blue' }];
  });
}

// Vista de detalhe do cartão: pessoa · empresa.
function crmBadgeCompleto(t) {
  return t.get('card', 'shared', 'crmBadge').then(function(badge) {
    if (!badge || !badge.pessoa) return [];
    const texto = badge.empresa ? badge.pessoa + ' · ' + badge.empresa : badge.pessoa;
    return [{ text: texto, color: 'blue' }];
  });
}

TrelloPowerUp.initialize({
  'card-buttons': function(t, options) {
    return [{
      icon: ICON,
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
      icon: { dark: ICON, light: ICON },
      text: 'Pesquisa CRM',
      callback: abrirPesquisa
    }];
  },

  'card-back-section': function(t, options) {
    return {
      title: 'CRM Auratus',
      icon: ICON,
      content: {
        type: 'iframe',
        url: t.signUrl('./card-section.html'),
        height: 80
      },
      action: {
        text: '🔍 Pesquisar',
        callback: abrirPesquisa
      }
    };
  },

  'card-badges': function(t, options) {
    return crmBadgeEmpresa(t);
  },

  'card-detail-badges': function(t, options) {
    return crmBadgeCompleto(t);
  }
});
