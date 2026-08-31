/**
 * Meta Conversions API — Vercel Function (Server-side)
 * =====================================================
 * Recebe eventos de contato/lead do frontend e os envia
 * diretamente para a API de Conversões da Meta (Graph API).
 *
 * Por que server-side (Vercel Function)?
 *  - Cobre perda de dados causada por iOS 14+ e bloqueadores de
 *    cookies, pois o envio acontece fora do navegador.
 *  - Mantém o access_token SEGURO (nunca exposto no frontend).
 *
 * Variáveis de ambiente (configurar na Vercel):
 *  - META_PIXEL_ID           (obrigatório) - ex: 919996697401633
 *  - META_CAPI_ACCESS_TOKEN  (obrigatório) - token de acesso do evento
 *  - META_TEST_EVENT_CODE    (opcional)    - código da "API Teste" do Meta
 */

// Hasheia em SHA-256 (padrão exigido pela Meta)
const crypto = require('crypto');

function sha256(value) {
  if (!value) return value;
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

// Normaliza/hasheia dados de usuário
function buildUserData(body, req) {
  const user = {};

  // client_ip_address: melhor fonte é o header x-forwarded-for,
  // preenchido pelo proxy da Vercel (o browser não expõe seu IP ao JS).
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded
    ? String(forwarded).split(',')[0].trim()
    : (body.client_ip_address || '');
  if (ip) user.client_ip_address = ip;

  // client_user_agent: vem do header user-agent (mais confiável que o JS).
  const ua = req.headers['user-agent'] || body.client_user_agent || '';
  if (ua) user.client_user_agent = String(ua);

  // fbp / fbc / em / ph devem ser hasheados em SHA-256 antes do envio.
  if (body.fbp) user.fbp = sha256(body.fbp);
  if (body.fbc) user.fbc = sha256(body.fbc);
  if (body.em) user.em = sha256(body.em);
  if (body.ph) user.ph = sha256(body.ph);

  return user;
}

module.exports = async function handler(req, res) {
  // 1) Apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2) Lê variáveis de ambiente
  const PIXEL_ID = process.env.META_PIXEL_ID;
  const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;

  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return res.status(500).json({
      error: 'Server misconfigured: META_PIXEL_ID ou META_CAPI_ACCESS_TOKEN não definidos.',
    });
  }

  // 3) Parse do corpo
  let body;
  try {
    body = req.body || {};
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  // 4) Validações básicas
  const eventId = body.event_id;
  const eventTime = body.event_time || Math.floor(Date.now() / 1000);
  // Evento de conversão da campanha: "Entrar em contato" -> Contact
  const eventName = body.event_name || 'Contact';

  if (!eventId) {
    return res.status(400).json({ error: 'event_id é obrigatório (para dedup com o Pixel).' });
  }

  // 5) Monta dados de usuário (hasheando)
  const userData = buildUserData(body, req);

  // 6) Monta o payload para a Meta
  const eventPayload = {
    data: [
      {
        event_name: eventName,
        event_time: Number(eventTime),
        event_id: String(eventId),
        action_source: 'website',
        event_source_url: body.event_source_url || '',
        user_data: userData,
        custom_data: {
          content_name: body.content_name || 'contato_whatsapp',
          currency: 'BRL',
          value: body.value || 0,
        },
      },
    ],
  };

  if (process.env.META_TEST_EVENT_CODE) {
    eventPayload.test_event_code = process.env.META_TEST_EVENT_CODE;
  }

  // 7) Envia à Meta Graph API
  const url =
    `https://graph.facebook.com/v19.0/${PIXEL_ID}/events` +
    `?access_token=${encodeURIComponent(ACCESS_TOKEN)}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      // Retorna o erro da Meta (sem expor o token) para debug
      return res.status(response.status).json({
        error: 'Meta API error',
        detail: data,
      });
    }

    return res.status(200).json({
      success: true,
      ...data,
      debug: {
        // Não expõe o token; apenas informa se o modo teste está ativo
        test_mode_active: Boolean(process.env.META_TEST_EVENT_CODE),
        pixel_id_configured: Boolean(PIXEL_ID),
      },
    });
  } catch (e) {
    return res.status(500).json({ error: 'Falha ao enviar à Meta', detail: e.message });
  }
}
