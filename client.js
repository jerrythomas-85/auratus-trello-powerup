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

  'card-back-section': function(t, options) {
    return {
      title: 'Pesquisa CRM',
      icon: ICON,
      content: {
        type: 'iframe',
        url: t.signUrl('./section-test.html'),
        height: 120
      }
    };
  }
});
