// Troca o código de autorização do Google por access_token + refresh_token.
// O client_secret nunca sai do servidor (env var na Cloudflare).

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
    const { code, redirect_uri } = await request.json();
    if (!code || !redirect_uri) return json({ error: 'missing_params' }, 400);

    const body = new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri,
      grant_type: 'authorization_code'
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const data = await res.json();
    if (!res.ok) return json({ error: data.error || 'token_error', detail: data.error_description || '' }, 400);

    return json({
      access_token: data.access_token,
      refresh_token: data.refresh_token || '',
      expires_in: data.expires_in
    });
  } catch (e) {
    return json({ error: 'exception', detail: String(e) }, 500);
  }
}
