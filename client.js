// ============================================================
// CLIENT.JS — Inicialização do Power-Up Trello
// ============================================================

TrelloPowerUp.initialize({
  'card-buttons': function(t, options) {
    return [{
      icon: 'https://cdn-icons-png.flaticon.com/512/561/561127.png',
      text: 'CRM Auratus',
      callback: function(t) {
        return t.popup({
          title: 'CRM Auratus',
          url: './sidebar.html',
          height: 600
        });
      }
    }];
  }
});
