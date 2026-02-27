# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Inicia el servidor de desarrollo en http://localhost:3000
npm run build    # Compila la aplicación para producción
npm run start    # Arranca el servidor de producción
npm run lint     # Ejecuta ESLint
```

No hay tests configurados en este proyecto.

## Arquitectura

Aplicación Next.js 14 (App Router) de una sola página para envío masivo de CVs por email. La UI es una SPA con pestañas; toda la lógica de envío real ocurre en el servidor vía API Routes.

### Flujo de datos

1. **Estado global en `page.tsx`**: toda la app vive en un único componente raíz que mantiene `contacts`, `emailTemplate`, `cvFile` y `smtpConfig`. El estado se persiste automáticamente en `localStorage` via `src/lib/storage.ts` (excepto la contraseña SMTP, que solo existe en memoria para no persistirla).

2. **Pestañas como vistas**: las pestañas no hacen routing — simplemente muestran/ocultan divs con `className={activeTab === 'x' ? '' : 'hidden'}`.

3. **CV**: se sube al servidor mediante `POST /api/upload-cv` y se guarda en `tmp/uploads/`. El `serverPath` resultante se almacena en el estado y se usa al enviar.

4. **Envío**: `POST /api/send-emails` recibe SMTP config (con password), contactos, plantilla y ruta del CV. Envía correos secuencialmente con un delay de 1200ms entre cada uno para evitar rate limiting.

### Estructura de módulos

- `src/types/index.ts` — todas las interfaces compartidas (`Contact`, `SmtpConfig`, `EmailTemplate`, `CvFile`, `AppState`)
- `src/lib/storage.ts` — persistencia en localStorage con clave `cv-mailer-state`
- `src/lib/csv-parser.ts` — parsea CSV con PapaParse; detecta columnas por alias en español e inglés
- `src/lib/template.ts` — interpolación de `{{company}}` y `{{email}}` en asunto/cuerpo
- `src/lib/email.ts` — crea transporter de nodemailer y construye opciones de correo
- `src/app/api/test-smtp/route.ts` — verifica conexión SMTP sin enviar
- `src/app/api/upload-cv/route.ts` — acepta PDF ≤10MB, lo guarda en `tmp/uploads/`
- `src/app/api/send-emails/route.ts` — envío en serie con resultados por contacto

### Variables de entorno

Opcionales: la configuración SMTP puede hacerse desde la UI. Si se definen en `.env.local`, se usan como valores iniciales:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx
```

Copiar `.env.local.example` a `.env.local` para configurarlas.
