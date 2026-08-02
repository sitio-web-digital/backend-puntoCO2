# Matafuego SaaS

SaaS B2B multi-tenant para empresas de venta, recarga e inspección de matafuegos (extintores). Contexto: Argentina.

Desarrollo en solitario (usuario + Claude como asistente), sin equipo de revisión par. Por eso los gates automáticos de CI actúan como gatekeeper obligatorio: nada se mergea/deploya sin pasar todos los checks en verde.

## Modo de trabajo autónomo

El modo de permisos de este proyecto es `auto` (`.claude/settings.local.json`): las acciones reversibles (crear/editar archivos, instalar dependencias, correr tests, git commit, etc.) no requieren confirmación; las acciones destructivas/irreversibles siguen frenando para confirmación, como red de seguridad.

Durante la implementación de una feature, no interrumpir al usuario con preguntas de aclaración salvo bloqueo genuino (ambigüedad que cambia el diseño de datos, o decisión de negocio que no se puede inferir del dominio). Ante decisiones menores de implementación, elegir la opción más simple y coherente con las pautas de este archivo, dejar constancia de la decisión en el resumen final, y seguir. Encadenar tareas relacionadas sin pausar entre cada una — reportar avances y resultado final en un solo resumen al terminar, no un mensaje por paso.

## Stack

- **Full-stack**: Next.js (TypeScript, modo estricto) — un solo repo, un solo deploy.
- **DB**: PostgreSQL gestionado (Neon o Supabase), con Row-Level Security nativo habilitado.
- **ORM**: Prisma o Drizzle, con un wrapper de queries que inyecta `tenant_id` automáticamente en cada operación (defensa en profundidad junto con RLS).
- **Auth**: Auth.js o Lucia. Passwords con argon2. Sesiones cortas + refresh token rotativo.
- **Testing**: Vitest (unit/integration) + Playwright (e2e).
- **CI/CD**: GitHub Actions — gates secuenciales: lint → typecheck → tests → security scan (npm audit/Snyk) → build → deploy.
- **Hosting**: Vercel + DB gestionada.
- **Monitoreo**: Sentry (errores) + logging centralizado, sin datos sensibles en logs.
- **Pagos**: si hay cobros, delegar a Mercado Pago. Nunca almacenar datos de tarjeta propios.

## Multi-tenancy

Aislamiento por fila: todas las tablas de negocio llevan `tenant_id`. Doble capa de protección:
1. Row-Level Security en Postgres.
2. Filtro obligatorio por `tenant_id` en la capa de acceso a datos (wrapper de queries), nunca confiar solo en el ID que llega del cliente.

Cualquier endpoint o query nueva que toque datos de negocio debe verificar pertenencia al tenant antes de leer/escribir.

## Seguridad (no negociable)

- Validación de inputs siempre server-side.
- RBAC explícito: super-admin plataforma, admin empresa, técnico, cliente final.
- Nunca hardcodear secretos ni commitearlos; usar variables de entorno.
- TLS en tránsito, cifrado en reposo para datos sensibles (facturación, datos de clientes).
- Checklist OWASP Top 10 aplicado a cada feature nueva.
- Logs de auditoría inmutables para operaciones críticas: emisión/modificación de certificados de recarga o inspección (tienen valor legal, no deben poder editarse retroactivamente sin dejar rastro).
- Antes de cerrar cualquier feature sensible (auth, facturación, permisos, certificados), correr revisión de seguridad sobre el diff (`/security-review`) como reemplazo del segundo par de ojos que no existe en un equipo de una persona.
- Backups cifrados, con prueba de restauración periódica.

## Testing (no negociable)

- Pirámide de testing: mayoría unit tests en lógica de negocio (cálculo de vencimientos, próximas inspecciones), integration tests en flujos de API, e2e solo en los flujos críticos (alta de cliente, emisión de certificado, facturación).
- Cobertura mínima objetivo: 80% en el dominio de negocio.
- SAST/DAST automatizado en el pipeline de CI, no solo tests funcionales.
- Staging que espeje producción antes de cualquier deploy a producción.

## Cumplimiento normativo

- Ley de Protección de Datos Personales (25.326): consentimiento explícito al dar de alta datos de clientes, mecanismo de acceso/rectificación/supresión para el titular de los datos, aviso de privacidad visible.
- Certificados de recarga/inspección con validez legal (normativa IRAM): inmutabilidad con auditoría, no edición retroactiva silenciosa.

## Definition of Done

Una feature está terminada cuando: funciona, tiene tests (unit + integration donde aplique), pasó lint/typecheck/security scan en CI, y si toca un área sensible, pasó `/security-review`.
