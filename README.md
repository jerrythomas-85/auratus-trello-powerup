# auratus-trello-powerup

Power-Up "CRM Auratus" do Trello (alojado no Cloudflare Pages: https://auratus-trello-powerup.pages.dev).

Desde 24 nov 2026 os dados do CRM vivem na **Copa** (https://copa.auratus.pt, base de dados Supabase), já não na folha TRELLO_AI_WORKSPACE:

- `auth.js` — entrar com a conta da Copa (email @auratus.pt, código por email e app de autenticação). A sessão fica neste browser, dentro do Trello.
- `sheets.js` — leituras e gravações na Copa (o nome ficou o antigo para não mexer no resto). As permissões são as da Copa (RLS).
- `vendor/supabase-2.119.2.js` — biblioteca do Supabase (cópia fixa).
- As avenças só se leem aqui; criam-se e alteram-se na Copa (ARD).
