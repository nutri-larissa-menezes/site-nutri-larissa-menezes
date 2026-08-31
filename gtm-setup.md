# Google Tag Manager — Configuração do rastreamento Meta

Este guia descreve como configurar o GTM para rastrear o **Meta Pixel** do site da Larissa Menezes, de modo que **não haja duplicação** entre Pixel (GTM) e Conversions API (CAPI).

## Arquitetura (resumo)

| Canal | PageView | Contact (conversão da campanha) |
|-------|----------|----------------|
| **Pixel (GTM)** | ✅ | ✅ |
| **CAPI (Vercel Function)** | ❌ | ✅ |

- **PageView** vai apenas pelo Pixel (via GTM).
- **Contact** vai pelo Pixel **e** pela CAPI, compartilhando o **mesmo `event_id`** → a Meta deduplica e conta o evento **1 única vez**.

> ⚠️ **Importante:** a campanha do Meta otimiza para o evento **`Contact`** ("Entrar em contato"). Todo o rastreamento de conversão deve emitir o nome de evento **`Contact`** (Pixel **e** CAPI) para que a ação do pop-up seja atribuída à conversão da campanha.

> ⚠️ **Não** adicione o Pixel do Meta solto diretamente no HTML. Todo o rastreamento do Pixel deve passar pelo GTM para evitar eventos duplicados.

---

## Pré-requisitos

1. `VITE_GTM_ID` configurado na Vercel (ver `ENV.md`).
2. Pixel ID: `919996697401633` (confirmado no HTML original).
3. Acesso de admin ao container GTM.

---

## Passo a passo

### 1. Criar a variável **`event_id`**

As tags de conversão (Pixel) precisam do `event_id` que o site já coloca no `dataLayer`.

- **Variáveis → Nova → Variável de camada de dados**
- Nome: `DLV - event_id`
- Nome da variável da camada de dados: `event_id`
- Versão da camada de dados: **Versão 2**

### 2. Criar a tag do **Pixel base (PageView)**

- **Tags → Nova**
- Nome: `Meta Pixel - PageView`
- **Configuração da tag**: modelo **Meta Pixel (Facebook Pixel)** → escolha *Custom HTML* ou o template oficial de configuração.
  - **Pixel ID**: `919996697401633`
  - Marque **"Suporte a Cookies Avançados"** se disponível (ajuda no `fbp` automático).
- **Déclanchar (Trigger)**: **All Pages** (todas as páginas).
- **Evento enviado**: `PageView` (padrão do Pixel no carregamento).

> Com o `fbp` criado pelo Pixel automaticamente, o site captura o cookie `_fbp` e o reutiliza na CAPI.

### 3. Criar a tag do **Pixel de Conversão (Contact)**

- **Tags → Nova**
- Nome: `Meta Pixel - Contact`
- Configuração: **Meta Pixel** com código de evento padrão:
  ```html
  fbq('track', 'Contact', {
    content_name: 'contato_whatsapp',
    eventID: '{{DLV - event_id}}'
  });
  ```
- **Déclanchar (Trigger)**: **Custom Event** → nome do evento: `generate_contact`.

### 4. Configurar o gatilho `generate_contact`

O site dispara no `dataLayer` quando o usuário clica em **"Entendi e quero FALAR COM A LARISSA"**:

```js
dataLayer.push({
  event: 'generate_contact',
  event_id: '<id-único>',
  content_name: 'contato_whatsapp',
  waba_number: '5521967308920'
});
```

- **Triggers → Nova → Gatilho personalizado**
- Tipo de evento: **Custom Event**
- Nome do evento: `generate_contact`
- Este gatilho ativa a tag de Conversão (Passo 3).

> **Por que `generate_contact` e não `click`?** O site só dispara quando o contato real acontece (o modal de validação é pulado no clique final), evitando conversões falsas por cliques em CTAs que apenas abrem o modal.

> **Nome do evento na Meta:** a tag dispara `fbq('track', 'Contact', ...)`, que corresponde ao evento **`Contact`** ("Entrar em contato") que sua campanha já otimiza.

---

## Anti-duplicação (como está garantida)

1. **`event_id` idêntico** entre o Pixel (enviado via `dataLayer` → GTM) e a CAPI (enviado via `fetch('/api/meta-event')`). A Meta usa o `event_id` para deduplicar eventos do mesmo valor.
2. **Pixel apenas via GTM** — nenhum `fbq`/`<script>` do Meta solto no `index.html`.
3. **PageView não envia à CAPI** — evita duplicidade no canal servidor.
4. A CAPI **hasheia** `fbp`, `fbc`, `em`, `ph` em SHA-256 (exigência do Meta) e envia `client_ip_address`/`client_user_agent` a partir dos headers da requisição.

---

## Teste/Validação

1. **API Teste do Meta** (Events Manager): preencha `META_TEST_EVENT_CODE` na Vercel e verifique os eventos marcados como *test* chegando à CAPI com o `event_id` correto.
2. **Facebook Pixel Helper** (extensão do Chrome): abra o site, confirme o `PageView` no carregamento e o `Contact` após clicar em **"Entendi e quero FALAR COM A LARISSA"**.
3. **Events Manager → Atividade em tempo real**: confira que o evento `Contact` aparece **apenas 1 vez** (dedup OK) mesmo com Pixel + CAPI ativos.

---

## Checklist final

- [ ] `VITE_GTM_ID`, `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN` configurados na Vercel
- [ ] Redeploy feito (env vars são lidas no build/fluxo)
- [ ] Tag Pixel **PageView** → All Pages
- [ ] Tag Pixel **Contact** → `generate_contact`, usando `{{DLV - event_id}}`, disparando `fbq('track', 'Contact', ...)`
- [ ] Variável `event_id` criada (Versão 2)
- [ ] `META_TEST_EVENT_CODE` usado só durante a validação (remover depois)
