# Plano — Aprovação de calendário (Amanda → cliente) com envio automático de PDF

> Documento de execução. Cada fase tem **o que fazer**, **arquivos**, **detalhes** e **critério de pronto**.
> Execute em ordem, um commit por fase, rodando os testes ao fim de cada uma.

## 0. Contexto e objetivo

**Hoje**

- `CalendarEntry.status` (`backend/app/models/calendar_entry.py`, enum em `schemas/calendar_entry.py`) controla o kanban de produção por postagem: `producao → andamento → modificacoes → checagem_aprovacao → finalizados ("Aprovados") → publicados`.
- `CalendarPeriod` (`backend/app/models/calendar_period.py`) já controla o **mês inteiro de um cliente**: `em_andamento` (editável), `reprovado` (editável), `finalizado` (trava create/edit/delete). Endpoint em `backend/app/routers/calendar_periods.py`.
- `Client.whatsapp_group_id` (`backend/app/models/client.py`) já existe — hoje usado para outra coisa, mas é o grupo de WhatsApp do cliente.
- WhatsApp já integrado via **Evolution API** (gateway não-oficial): `backend/app/core/evolution_client.py`, `backend/app/routers/whatsapp.py`, `whatsapp_webhook.py`.
- PDF do calendário já existe no frontend: `crm/lib/calendarPdf.ts` + `crm/components/calendar/CalendarReport.tsx` (jsPDF).

**Objetivo**

1. Amanda (dona) revisa e aprova/reprova o mês inteiro de um cliente antes de qualquer coisa ir pro cliente.
2. Só depois da aprovação da Amanda, o PDF do calendário é enviado automaticamente para o **grupo de WhatsApp do cliente** (via Evolution — ver nota sobre API oficial abaixo).
3. Toda decisão (quem aprovou/reprovou, quando, motivo se reprovado) fica registrada e auditável.

**Fora de escopo nesta fase:** botão de aprovar/reprovar clicável dentro do WhatsApp (isso exige migrar para a WhatsApp Cloud API oficial da Meta, que não suporta grupos — ver seção 6, "Nota sobre API oficial"). Nesta primeira fase o cliente aprova/reprova **numa tela do CRM com link enviado por WhatsApp**, não por botão nativo do WhatsApp.

## 1. Modelo de estados

Estende `CalendarPeriod.status` (hoje `em_andamento` / `reprovado` / `finalizado`) para a cadeia de aprovação:

```
em_andamento
    → enviado_aprovacao_amanda      (time pediu revisão)
        → reprovado_amanda          (Amanda reprovou → volta pra em_andamento com motivo)
        → aprovado_amanda           (Amanda aprovou → dispara envio ao cliente)
            → enviado_aprovacao_cliente
                → reprovado_cliente (cliente reprovou → volta pra em_andamento com motivo)
                → aprovado_cliente  (cliente aprovou → período fica "finalizado")
```

`finalizado` continua existindo como estado terminal (equivalente a `aprovado_cliente` já consolidado — pode reaproveitar o mesmo valor ou manter os dois, ver Fase 1).

## 2. Fase 1 — Modelo de dados

**O que fazer:** criar tabela de auditoria de aprovações e estender `CalendarPeriod`.

**Arquivos:**
- `backend/app/models/calendar_approval.py` (novo)
- `backend/app/models/calendar_period.py` (editar: novos valores de `status`, nenhuma coluna nova necessária)
- `backend/app/models/__init__.py` (registrar novo model)
- Migration Alembic nova

**Detalhes:**

```python
class CalendarApproval(Base):
    __tablename__ = "calendar_approvals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    period_id: Mapped[int] = mapped_column(ForeignKey("calendar_periods.id"), nullable=False, index=True)
    stage: Mapped[str] = mapped_column(String(20), nullable=False)      # "amanda" | "cliente"
    decision: Mapped[str] = mapped_column(String(20), nullable=False)   # "aprovado" | "reprovado"
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)     # obrigatório quando reprovado (validado no schema)
    decided_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)  # null quando é o cliente (sem login)
    decided_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
```

Por que uma tabela separada e não só um campo em `CalendarPeriod`: cada envio para aprovação pode ser reprovado e reenviado várias vezes — precisa do histórico completo (quem reprovou, por quê, quando), não só o último estado.

**Critério de pronto:** migration aplica limpo em dev; `CalendarApproval` com FK e índice em `period_id`.

## 3. Fase 2 — Link de aprovação do cliente (sem login)

**O que fazer:** o cliente não tem conta no CRM, então a aprovação dele precisa de um link assinado e de expiração curta — igual um "magic link".

**Arquivos:**
- `backend/app/core/security.py` (adicionar `create_approval_token` / `decode_approval_token`, JWT curto com `period_id` + `typ="calendar_approval"`, sem usuário associado)
- `backend/app/routers/calendar_periods.py` (endpoint novo, público, só aceita o token assinado)
- `crm/app/aprovacao/[token]/page.tsx` (novo, página pública fora do layout autenticado — lista as postagens do mês com preview + botões Aprovar/Reprovar)

**Detalhes:**
- Token expira em alguns dias (ex: 7) e vira inválido assim que uma decisão é registrada (checar `CalendarApproval` existente pro stage antes de aceitar novo voto).
- Reprovar exige campo de motivo (obrigatório no schema do endpoint).
- Rota pública não expõe nada do cliente além do que já está no calendário (sem lista de outros clientes, sem dados financeiros).

**Critério de pronto:** acessar o link sem estar logado mostra o calendário e aceita uma decisão única.

## 4. Fase 3 — Endpoints de aprovação (Amanda)

**Arquivos:**
- `backend/app/routers/calendar_periods.py`

**Endpoints novos:**
- `POST /calendar-periods/{id}/enviar-aprovacao` — `em_andamento` → `enviado_aprovacao_amanda`. Requer permissão (ex: `calendar.edit`).
- `POST /calendar-periods/{id}/decisao-amanda` — body `{decision, reason?}`. Requer role/permissão nova `calendar.approve` (restrita à Amanda — ver Fase 5). Grava `CalendarApproval(stage="amanda", ...)`. Se aprovado → dispara Fase 6 (envio ao cliente) e avança status para `enviado_aprovacao_cliente`. Se reprovado → volta para `em_andamento`.
- `POST /calendar-periods/approval/{token}/decisao` (público, token da Fase 2) — grava `CalendarApproval(stage="cliente", decided_by_user_id=None)`. Se aprovado → `finalizado`. Se reprovado → `em_andamento`.

**Critério de pronto:** fluxo completo testável via Swagger/curl sem frontend.

## 5. Fase 4 — Permissão "aprovador"

**O que fazer:** restringir quem pode decidir como Amanda. Reaproveita o catálogo de permissões existente (`app/core/permissions.py`, `require_permission`).

**Detalhes:**
- Nova permission key: `calendar.approve`.
- Atribuída só à conta da Amanda (via tela de equipe existente, `routers/team.py`) — não precisa de role nova no model, só a permission no catálogo.

**Critério de pronto:** usuário sem `calendar.approve` recebe 403 em `/decisao-amanda`.

## 6. Fase 5 — Geração e envio do PDF

**O que fazer:** mover a geração do PDF para o backend (hoje é só no frontend via jsPDF) para poder disparar o envio automaticamente, sem depender de alguém estar com o navegador aberto.

**Arquivos:**
- `backend/app/services/calendar_pdf.py` (novo) — reconstrói a mesma estrutura de `CalendarReport.tsx` em Python (ex: `weasyprint` a partir de um template HTML, ou `reportlab` programático). Reaproveita a mesma regra já documentada: **não inclui `reference_image`** no PDF.
- `backend/app/services/calendar_approval.py` (novo) — orquestra: gera PDF → sobe pro R2 (mesmo bucket das outras mídias) → chama `evolution_client` para mandar o documento no `client.whatsapp_group_id` → monta e inclui o link da Fase 2 na mensagem de texto (Evolution não suporta botão nativo).

**Mensagem enviada ao grupo (texto + documento):**
```
📅 Calendário de conteúdo de {mês}/{ano} aprovado internamente.
Para aprovar ou pedir ajustes, acesse: {link da Fase 2}
[PDF anexado]
```

**Critério de pronto:** ao chamar `decisao-amanda` com `decision=aprovado`, o grupo do cliente recebe a mensagem com o PDF em ambiente de teste (Evolution sandbox/instância de dev).

## 7. Fase 6 — Frontend (CRM)

**Arquivos:**
- `crm/components/production/ProductionBoard.tsx` ou tela de calendário do cliente — botão "Enviar para aprovação da Amanda", visível só quando o período está `em_andamento` (e o mês está completo/revisado).
- Nova tela interna de aprovação da Amanda (lista períodos em `enviado_aprovacao_amanda`, com preview e botões Aprovar/Reprovar + campo de motivo).
- `crm/app/aprovacao/[token]/page.tsx` — já coberta na Fase 2.
- `crm/services/client/` + `crm/services/server/` — novos clients de API seguindo o padrão existente (Route Handler → backend, nunca browser → backend direto).

**Critério de pronto:** fluxo ponta a ponta clicável: time envia → Amanda aprova pelo CRM → cliente recebe WhatsApp → cliente aprova pelo link → período fica `finalizado`.

## 8. Nota sobre API oficial da Meta (botão nativo no WhatsApp)

Perguntado nesta conversa: dá pra ter o botão "Aprovar/Reprovar" nativo, clicável, dentro do próprio WhatsApp?

Sim, mas com uma mudança de arquitetura relevante:
- Exige **WhatsApp Cloud API oficial** (conta Business verificada na Meta), que roda em paralelo ao Evolution — são integrações diferentes.
- O botão exige **Message Template pré-aprovado pela Meta** (documento no header + botões de quick reply), porque o envio é iniciado pela empresa, não pelo cliente.
- **Grupos não são suportados pela API oficial** — só conversas 1:1 com um número de telefone. Precisaria de um campo novo `whatsapp_number` em `Client` (o `whatsapp_group_id` atual não serve pra isso) e decidir pra qual contato specific do cliente mandar.
- Precisa de um webhook novo (ou extensão do `whatsapp_webhook.py`) pra receber o `button_reply` da Meta e traduzir pra uma chamada equivalente ao endpoint da Fase 3.

Essa é uma fase separada e maior (cadastro Meta Business, verificação, aprovação de template — processo que não é instantâneo). O plano acima (Fases 1–7) entrega o fluxo de aprovação completo e funcional sem depender disso; o botão nativo fica como evolução posterior, reaproveitando os mesmos endpoints internos (`decisao-amanda`, `decisao` do cliente) — só troca o canal de entrada do lado do cliente.
