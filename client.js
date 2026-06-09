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
      title: 'Pesquisa CRM',
      icon: ICON,
      content: {
        type: 'iframe',
        url: t.signUrl('./search.html'),
        height: 400
      }
    };
  }
});
