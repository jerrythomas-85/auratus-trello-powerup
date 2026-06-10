// Renova o access_token a partir de um refresh_token (sem interação do utilizador).

const ALLOWED_ORIGIN = 'https://auratus-trello-powerup.pages.dev';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Só aceita pedidos vindos do nosso domínio (Origin, ou Referer em fallback).
function origemPermitida(request) {
  const origin = request.headers.get('Origin');
  if (origin) return origin === ALLOWED_ORIGIN;
  const referer = request.headers.get('Referer');
  if (referer) return referer === ALLOWED_ORIGIN || referer.startsWith(ALLOWED_ORIGIN + '/');
  return false;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!origemPermitida(request)) return json({ error: 'forbidden' }, 403);
  try {
    const { refresh_token } = await request.json();
    if (!refresh_token) return json({ error: 'missing_refresh_token' }, 400);

    const body = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token,
      grant_type: 'refresh_token'
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const data = await res.json();
    if (!res.ok) return json({ error: data.error || 'refresh_error', detail: data.error_description || '' }, 400);

    return json({ access_token: data.access_token, expires_in: data.expires_in });
  } catch (e) {
    return json({ error: 'exception', detail: String(e) }, 500);
  }
}
