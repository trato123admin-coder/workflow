# Guía de Contribución y Flujo de Trabajo

Este repositorio sigue las directrices no negociables definidas en `AGENTS.md` y `docs/02-plan-sprints.md`.

---

## 1. Reglas Principales

1. **Un sprint = una rama = una conversación.** Nombre de rama: `feat/sprint-N-tema`.
2. **Convención de Commits:** Commits convencionales (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).
3. **Seguridad y Secretos:**
   - NUNCA commitear archivos `.env` con credenciales reales.
   - Usar `.env.example` solo con nombres de variables y valores vacíos.
4. **Base de Datos:**
   - Todo cambio de esquema es una nueva migración versionada en `supabase/migrations/`.
   - Prohibido editar migraciones aplicadas.
   - Toda tabla en el esquema `public` DEBE tener Row Level Security (RLS) habilitada.
5. **Calidad de Código:**
   - Archivos de máximo 300 líneas.
   - Funciones de máximo 30 líneas.
   - Sin `console.log` en producción; usar el logger estructurado.
   - Código e identificadores en inglés; textos de UI en español (es-PE) vía `next-intl`.

---

## 2. Definición de Hecho (Definition of Done - DoD)

Antes de considerar cerrado un sprint o fusionar un Pull Request:

- [ ] `pnpm lint`, `pnpm typecheck` y `pnpm test` pasan al 100% en verde.
- [ ] Pruebas pgTAP pasan (`supabase test db`).
- [ ] Toda tabla nueva en `public` tiene RLS y prueba pgTAP asociada.
- [ ] `.env.example` actualizado si se agregaron nuevas variables.
- [ ] `CHANGELOG.md` actualizado con los cambios del sprint.
- [ ] ADR agregado si se tomó una decisión de arquitectura relevante.
