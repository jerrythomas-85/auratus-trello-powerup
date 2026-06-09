// ============================================================
// SEARCH.JS — Vista de pesquisa CRM board-level (esqueleto)
// ============================================================

let t;

document.addEventListener('DOMContentLoaded', () => {
  t = TrelloPowerUp.iframe();
  setupTabs();
});

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });
}
