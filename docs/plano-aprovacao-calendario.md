# Aprovação do calendário (Amanda → Produção)

> Este arquivo descrevia, antes, um fluxo em duas etapas (Amanda → cliente, com envio de PDF e link no
> WhatsApp). **A etapa do cliente foi removida**: a aprovação da Amanda já manda o mês pra Produção.

## Fluxo

```
em_andamento ──(time envia)──▶ enviado_aprovacao_amanda ──(Amanda aprova)──▶ finalizado ("Aprovado")
      ▲                                   │
      └──────────── reprovado ◀───────────┘  (Amanda reprova com motivo; dá pra editar e reenviar)
```

- O status é do **mês inteiro de um cliente** (`CalendarPeriod`), não de cada postagem.
- **Enviar para aprovação** não gera mais PDF: a Amanda revisa o calendário dentro do CRM
  (tela **Aprovações** ou o calendário do cliente).
- **Aprovar** (`POST /calendar-periods/decisao-amanda`, permissão `calendar.approve`):
  - o mês vira `finalizado` e as postagens entram na **Produção** (a tela só lista meses `finalizado`
    e demandas avulsas);
  - cada designer recebe **um aviso** com a contagem das demandas dele (`services/demands.py`);
  - nada é enviado ao WhatsApp do cliente.
- **Reprovar** exige motivo; o mês vira `reprovado`, volta a ser editável e pode ser reenviado.
- Toda decisão fica em `calendar_approvals` (quem, quando, motivo).

## O que mudou em relação ao fluxo antigo

| Antes | Agora |
|---|---|
| `enviado_aprovacao_cliente` | removido (a migração leve converte esses meses e o antigo `aprovado_amanda` em `finalizado`) |
| PDF gerado e enviado ao grupo de WhatsApp do cliente com link de aprovação | removido |
| Página pública `/aprovacao/[token]` e rotas `/calendar-periods/approval/{token}` | removidas |
| `POST /uploads/presign-document` (upload do PDF no R2) | removido |
| Token assinado do cliente (`CALENDAR_APPROVAL_TOKEN_EXPIRE_DAYS`) | removido |
| `pdf_url` em `calendar_periods` | coluna mantida, sem uso (o envio ainda aceita o campo, ignorado pelo front) |

`Client.whatsapp_group_id` continua: ele liga a conversa do grupo ao cliente na tela de WhatsApp.

## Onde fica no código

- Backend: `routers/calendar_periods.py`, `services/calendar_approval.py` (só `record_decision`),
  `services/demands.py` (aviso aos designers), `schemas/calendar_period.py`, migração em `core/database.py`.
- CRM: `components/calendar/CalendarApprovalPanel.tsx`, `components/approvals/ApprovalsInboxClient.tsx`,
  `services/client/calendarPeriodApi.ts`, `types/calendarPeriod.ts`.
- Testes: `backend/tests/test_calendar_approval_flow.py`.
