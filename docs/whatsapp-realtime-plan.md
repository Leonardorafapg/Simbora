# Plano: WhatsApp em tempo real (contatos, digitando, tempo real)

## Onde estamos hoje

Sem banco, sem webhook, sem tempo real. Cada tela busca tudo na hora, direto na
Evolution API:
- Lista de conversas: `POST /chat/findChats/{instance}` a cada carregamento de página.
- Mensagens de uma conversa: `POST /chat/findMessages/{instance}` só quando você clica nela.
- Nada avisa o Simbora quando chega mensagem nova — só descobre se você reabrir a tela.

Corrigido nesta sessão (sem mudar essa arquitetura): ordem cronológica das
mensagens, separador de dia ("Hoje"/"Ontem"), nome de quem enviou em grupo.

## Referência: `slzfood-api` já resolveu isso

O outro projeto (`Foodapp/slzfood-api`) fala com o **mesmo servidor** Evolution
e já tem tempo real funcionando em produção, com uma arquitetura validada:
`webhook → Postgres → WebSocket → front`. O plano abaixo é portar esse padrão
pro Simbora, adaptado pra single-tenant (não precisa de `tenant_id`/salas).

---

## Fase 1 — Persistência + Webhook (base de tudo)

**Objetivo**: parar de perguntar pra Evolution toda vez; guardar mensagens no
nosso banco e deixar a Evolution avisar quando chega coisa nova.

1. **Modelos novos** (`backend/app/models/whatsapp_message.py`):
   - `WhatsAppMessage`: `id`, `remote_jid`, `message_id` (id da Evolution, pra
     dedup), `from_me`, `text`, `sender_name`, `timestamp`, `status` (enviada/
     entregue/lida/erro), `created_at`.
   - Não precisa de tabela de "conversa" separada como o slzfood (que é
     multi-tenant) — aqui a "conversa" é só `group by remote_jid`.

2. **Endpoint de webhook** (`backend/app/routers/whatsapp_webhook.py`):
   - `POST /api/v1/whatsapp/webhook` — **sem autenticação JWT** (quem chama é a
     Evolution, não um usuário logado). Autentica por um secret próprio
     (`EVOLUTION_WEBHOOK_SECRET`, novo env var), verificado num header
     (`x-webhook-secret`), igual ao slzfood.
   - Trata os eventos: `MESSAGES_UPSERT` (mensagem nova → salva no banco),
     `MESSAGES_UPDATE` (status de entrega → atualiza `status`),
     `CONNECTION_UPDATE` (conectou/caiu), `PRESENCE_UPDATE` (digitando — Fase 3).

3. **Registrar o webhook no connect**: depois de criar/reconectar a instância
   em `connect_instance()`, chamar `POST /webhook/set/{instance}` (novo método
   em `evolution_client.py`, mesmo payload do `set_webhook` do slzfood) —
   sempre, não só na criação (a Evolution não garante manter a config).

4. **Migrar os endpoints de leitura pra ler do banco**:
   - `GET /whatsapp/chats` → `SELECT DISTINCT remote_jid` com última
     mensagem/não lidas calculadas em SQL, em vez de bater na Evolution.
   - `GET /whatsapp/chats/{jid}/messages` → `SELECT` no banco, ordenado por
     timestamp — a Evolution só continua sendo usada pra **enviar**.

**Entrega desta fase**: histórico completo e permanente (hoje some quando a
Evolution decide expirar o cache dela), sem mudar nada visível na tela ainda.

## Fase 2 — WebSocket (tempo real de verdade)

1. **`backend/app/core/ws_manager.py`**: versão simplificada do do slzfood —
   sem `tenant_id` (só um "room" global, já que é single-tenant), broadcast
   pra todas as conexões abertas.
2. **`WS /api/v1/whatsapp/ws`**: autenticado pelo JWT (query param `token`,
   igual ao slzfood), aceita a conexão e fica só recebendo pings.
3. **Webhook dispara o broadcast**: toda vez que `MESSAGES_UPSERT` salva uma
   mensagem nova, manda `{"type": "whatsapp_mensagem", "mensagem": {...}}` pra
   todo mundo conectado.
4. **Frontend**: hook `useWhatsAppSocket()` conecta o WS na montagem da página
   e, ao receber `whatsapp_mensagem`, atualiza a lista de chats e (se for a
   conversa aberta) acrescenta a mensagem — sem re-fetch, sem polling. O
   polling de status (`POLL_INTERVAL_MS`) só continua fazendo sentido antes de
   conectar (tela de QR); depois de conectado, tudo vem pelo WS.

**Entrega desta fase**: mensagem aparece sozinha na tela, sem F5 — o "tempo
real" que você pediu.

## Fase 3 — "Digitando..."

Dois sentidos possíveis, ambos pequenos depois da Fase 1/2 estarem prontas:

- **Atendente → contato** (o WhatsApp da pessoa mostra "digitando..."): enviar
  `POST /chat/sendPresence/{instance}` com `presence: "composing"` enquanto o
  atendente digita na caixa de texto do Simbora (debounce de ~1s, best-effort —
  igual ao `send_presence` do slzfood). Não depende de webhook, só de outbound.
- **Contato → atendente** (mostrar "digitando..." no cabeçalho do chat, no
  Simbora): vem do evento `PRESENCE_UPDATE` no webhook (Fase 1), mapeado igual
  ao `_PRESENCE_MAP` do slzfood (`composing` → "digitando",
  `recording` → "gravando áudio"), empurrado via WS (Fase 2) pro front mostrar
  no header enquanto a pessoa está digitando.

## Ordem de entrega sugerida

| Fase | Entrega | Depende de |
|---|---|---|
| 1 | Histórico persistido + webhook recebendo eventos | nada (parte do zero) |
| 2 | Tempo real (mensagem aparece sozinha) | Fase 1 |
| 3 | Indicador de digitando (os dois sentidos) | Fase 1 (receber) / nada (enviar) |

Dá pra fazer 1 → 2 → 3 em sequência, cada uma já é uma entrega útil sozinha —
não precisa esperar tudo pronto pra usar. Recomendo começar pela Fase 1: é a
mais trabalhosa (modelo, migração, webhook) mas todo o resto depende dela.

## O que falta decidir antes de começar

1. **Domínio público do backend**: o webhook da Evolution precisa de uma URL
   pública fixa pra chamar de volta (`PUBLIC_API_URL`, como o slzfood tem) —
   confirma qual é a URL de produção do backend no Railway pra eu configurar
   certo.
2. **Retenção de mensagens antigas**: quer importar o histórico que já existe
   na Evolution (via `find_messages`) na hora de conectar pela primeira vez,
   ou começar o banco vazio e só acumular dali pra frente?
