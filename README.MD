# Simbora Maranhão — Presença Digital

Site institucional e landing pages da Simbora Maranhão,
agência de marketing digital de São Luís — MA.

Desenvolvido por Leonardo Rafael como desenvolvedor 
responsável pela arquitetura, implementação e deploy.

## Stack
- Astro 4.x — geração estática, performance e SEO
- Tailwind CSS — design system e estilização
- GSAP + ScrollTrigger — animações e scroll-driven background
- Vanilla JS — interatividade sem overhead de framework

## Decisões técnicas
- Arquitetura de componentes separados por contexto (site/ e lp/)
- Background animado via canvas fixo com transições por seção
- Landing pages com layout isolado (LayoutLP) sem dependências do site principal
- Zero frameworks JS no cliente — apenas o necessário

## Estrutura
src/
├── components/
│   ├── site/     → componentes do site institucional
│   └── lp/       → componentes das landing pages
├── layouts/      → Layout.astro e LayoutLP.astro
└── pages/        → rotas do site

## Deploy
Vercel — CI/CD automático via GitHub, branch main.

---
Desenvolvido por Leonardo Rafael
github.com/Leonardorafapg