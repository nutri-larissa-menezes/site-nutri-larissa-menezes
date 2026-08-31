# Variáveis de ambiente (Vercel)

Configure estas variáveis no painel da Vercel em **Project → Settings → Environment Variables**.

| Variável | Obrigatória | Valor de exemplo | Descrição |
|----------|-------------|------------------|-----------|
| `VITE_GTM_ID` | Sim (para GTM) | `GTM-XXXXXXX` | ID do container do Google Tag Manager. Injetado no build (é lido apenas no momento do `npm run build`). |
| `META_PIXEL_ID` | Sim (para CAPI) | `919996697401633` | ID do Pixel do Meta. Usado pela Vercel Function `api/meta-event.js`. |
| `META_CAPI_ACCESS_TOKEN` | Sim (para CAPI) | `EAA...` | Token de acesso da Conversions API. **NUNCA** deve aparecer no frontend. |
| `META_TEST_EVENT_CODE` | Não | código da "API Teste" | Se preenchido, os eventos enviados são marcados como *test* no Events Manager (útil para validar). Remova após a validação. |

## Como popular

1. No painel da Vercel, abra seu projeto → **Settings** → **Environment Variables**.
2. Adicione cada variável acima.
3. Se for usar em **Produção** e **Preview**, marque os ambientes desejados.
4. Em **Deployments**, clique em **Redeploy** para o novo build/function pegar as variáveis.

## Segurança

- `META_CAPI_ACCESS_TOKEN` **nunca** deve ser colocado em código HTML/JS. Ele só é lido server-side, dentro de `api/meta-event.js`, via `process.env`.
- `VITE_*` é injetada no bundle do frontend **apenas no build**. Use somente variáveis que não são segredos (como o GTM ID), nunca o access token.

## Fluxo completo

1. **PageView** → Pixel (via GTM) — configurado no GTM, sem CAPI.
2. **Contact** (clique em "Entendi e quero FALAR COM A LARISSA") → dispara no `dataLayer` (Pixel via GTM) **e** faz `fetch('/api/meta-event')` (CAPI), usando o **mesmo `event_id`** → Meta deduplica.

> **Nota:** o site foi construído com Vite. Alterar `VITE_GTM_ID` exige um novo **build** (redeploy), pois é embutido na hora do build — não basta mudar a env no painel sem republicar.
