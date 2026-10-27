# Agenda e notificações

## O que existe

| Aviso | Quem recebe | Quando |
|---|---|---|
| Novo compromisso / alterado / cancelado / removido | Participantes (menos quem fez a ação) | Na hora |
| Lembrete do compromisso | Todos os participantes | 1 dia antes e 30 min antes |
| Nova demanda (avulsa) ou demanda atribuída | Designer responsável | Na hora |
| N novas demandas (calendário aprovado) | Designer responsável — **um aviso por designer e cliente** | Quando o calendário do mês é aprovado |
| Vence amanhã / vence hoje | Designer responsável | A partir das 9h (Brasília), se a demanda ainda não foi entregue |

Os avisos aparecem no sino do CRM (tempo real por WebSocket) e, se a pessoa ativou, no celular (push).

## Onde fica no código

- `backend/app/services/notifications.py` — cria/lista/entrega avisos (chave anti-repetição `dedupe_key`).
- `backend/app/services/agenda.py` — avisos da agenda (marcar, alterar, cancelar).
- `backend/app/services/demands.py` — avisos de demanda nova.
- `backend/app/services/reminders.py` — lembretes (agenda e prazo). Constantes no topo: `DEADLINE_DAYS_BEFORE` e `DEADLINE_REMINDER_HOUR`.
- `backend/app/services/notification_worker.py` — laço que roda os lembretes a cada minuto (desliga com `NOTIFICATION_WORKER_ENABLED=false`).
- `backend/app/services/push.py` + `routers/push.py` — push no celular (Web Push).
- `crm/public/sw.js` — recebe o push e abre a tela certa ao tocar.

## Ativar o push no celular

1. Gere as chaves (uma vez): `cd backend && python -m app.scripts.generate_vapid`
2. Coloque no ambiente do backend (Railway): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` (`mailto:um-email-seu`).
   A chave privada é segredo; não vai pro git. Trocar o par depois exige que todos ativem de novo.
3. Cada pessoa abre **Configurações → Notificações no celular → Ativar neste aparelho**.
   - Android: funciona no Chrome (de preferência com o CRM instalado).
   - iPhone: só funciona com o CRM **instalado na tela inicial** (Compartilhar → Adicionar à Tela de Início), iOS 16.4 ou mais novo.

Sem as chaves o push fica desligado e o sino continua funcionando normalmente.

## Testes

- Backend: `cd backend && python -m pytest tests/test_agenda.py tests/test_notifications_phase2.py tests/test_push.py`
- CRM: `cd crm && npm test`
