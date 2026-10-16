# Upload de imagens no Cloudflare R2

Fluxo: o CRM pede `POST /api/uploads/presign` → backend assina uma URL de PUT
→ o browser envia o arquivo direto pro R2 → a URL pública (`url`) é gravada no
registro. URLs antigas do Cloudinary continuam funcionando (são só strings).

## Variáveis (backend)

| Variável | Exemplo |
|---|---|
| `R2_ACCOUNT_ID` | ID da conta Cloudflare |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | token de API do R2 com *Object Read & Write* só nesse bucket |
| `R2_BUCKET` | `simbora-crm` |
| `R2_PUBLIC_BASE_URL` | `https://media.simbora.com` (domínio customizado do bucket) |
| `R2_KEY_PREFIX` | `simbora-crm` (padrão) |
| `UPLOAD_MAX_BYTES` | `52428800` (padrão, 50 MB) |

## CORS do bucket (obrigatório — o browser faz PUT direto)

```json
[
  {
    "AllowedOrigins": ["https://crm-production-024f.up.railway.app", "http://localhost:3000"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

Leitura: habilitar *Custom Domain* (ou `r2.dev` só para testes) no bucket.

## Notas

- Formatos aceitos: JPG, PNG, WebP, GIF, AVIF (SVG fica de fora de propósito).
- A URL assinada fixa `Content-Type` e `Content-Length`; vale 5 min.
- `/uploads/from-url` (usado pelo MCP) baixa a imagem no backend e recusa hosts
  que resolvem para IP não público.
