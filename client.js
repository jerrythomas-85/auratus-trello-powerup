// ============================================================
// CLIENT.JS — Inicialização do Power-Up Trello
// ============================================================

const ICON = 'https://cdn-icons-png.flaticon.com/512/561/561127.png';

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
      callback: function(t) {
        return t.modal({
          title: 'Pesquisa CRM',
          url: './search.html',
          fullscreen: true
        });
      }
    }];
  }
});
