# Atomic Ticket - Sistema de Reservas con Stripe

[![CI](https://github.com/AngelPenalver/atomic-ticket/actions/workflows/ci.yml/badge.svg)](https://github.com/AngelPenalver/atomic-ticket/actions/workflows/ci.yml)

Sistema de reservas de tickets con control de concurrencia y pagos mediante Stripe.

## Características

- Control de Concurrencia: Solo un usuario puede reservar un asiento específico
- Pagos con Stripe: Integración completa con Stripe Checkout
- Webhooks: Confirmación automática de pagos
- Expiración Automática: Las reservas sin pagar se liberan tras `RESERVATION_TTL_MINUTES` (15 por defecto)
- Transacciones: Garantía de consistencia en la base de datos
- Idempotencia: Webhooks duplicados o tardíos no pueden vender un asiento dos veces (un pago tardío se reembolsa)
- Migraciones: El esquema se versiona con migraciones de TypeORM

---

## Setup Inicial

### 1. Requisitos Previos

- Node.js 22+
- pnpm (`corepack enable`)
- Docker y Docker Compose
- Cuenta de Stripe (modo test)
- Stripe CLI (opcional, para webhooks locales)

### 2. Instalación

```bash
# Clonar repositorio
git clone <repo-url>
cd atomic-ticket

# Instalar dependencias
pnpm install

# Copiar variables de entorno
cp .env.example .env

# Levantar base de datos con Docker
docker compose up -d
```

> Si tenías una base de datos creada con la versión anterior (`synchronize: true`), recréala con `docker compose down -v && docker compose up -d`: las migraciones esperan una base de datos vacía.

### 3. Configurar Stripe

Edita el archivo `.env`:

```bash
# Obtén tu clave secreta en: https://dashboard.stripe.com/test/apikeys
STRIPE_SECRET_KEY=sk_test_tu_clave_aqui

# Para webhooks locales (ver sección de Webhooks)
STRIPE_WEBHOOK_SECRET=whsec_tu_secret_aqui

# URL del frontend (para redirecciones de Stripe)
FRONTEND_URL=http://localhost:3000

# API key para endpoints de administración (mínimo 16 caracteres)
ADMIN_API_KEY=una-clave-larga-y-aleatoria
```

La aplicación valida las variables al arrancar y no inicia si falta alguna.

### 4. Iniciar Aplicación

```bash
# Modo desarrollo
pnpm run start:dev

# La API estará disponible en: http://localhost:3000/api/v1
```

Las migraciones pendientes se aplican automáticamente al arrancar. Para cambiar el esquema:

```bash
# Tras modificar una entidad, generar la migración
pnpm migration:generate src/database/migrations/NombreDelCambio

# Aplicar / revertir manualmente
pnpm migration:run
pnpm migration:revert
```

### 5. Verificar Base de Datos

Accede a Adminer en: http://localhost:8080

- **Sistema**: PostgreSQL
- **Servidor**: db
- **Usuario**: admin
- **Contraseña**: (ver .env)
- **Base de datos**: atomic-ticket-db

---

## Flujo Completo de Prueba

### Paso 1: Crear un Evento

```bash
curl -X POST http://localhost:3000/api/v1/events \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -d '{
    "name": "Concierto de Rock",
    "description": "Evento de prueba",
    "date": "2026-12-31T20:00:00Z",
    "total_tickets": 5,
    "price": 50
  }'
```

**Respuesta esperada:**
```json
{
  "id": "uuid-del-evento",
  "name": "Concierto de Rock",
  "description": "Evento de prueba",
  "total_tickets": 5
}
```

**Nota:** Guarda el `id` del evento para consultar los asientos.

---

### Paso 2: Obtener ID de un Asiento

```bash
curl http://localhost:3000/api/v1/seats/event/TU_EVENT_ID
```

Guarda el `id` de un asiento con `"status": "available"` para el siguiente paso.

---

### Paso 3: Simular Reserva de 2 Usuarios (Concurrencia)

Abre **2 terminales** y ejecuta estos comandos **simultáneamente**:

#### Terminal 1 - Usuario 1
```bash
curl -X POST http://localhost:3000/api/v1/orders/SEAT_ID/book \
  -H "Content-Type: application/json" \
  -d '{}' &
```

#### Terminal 2 - Usuario 2 (ejecutar inmediatamente después)
```bash
curl -X POST http://localhost:3000/api/v1/orders/SEAT_ID/book \
  -H "Content-Type: application/json" \
  -d '{"user_id": "3f1c2d5e-1111-4a2b-9c3d-123456789abc"}' &
```

> **Nota**: Reemplaza `SEAT_ID` con el UUID del asiento que obtuviste.

**Resultado Esperado:**

- **Usuario 1**: Obtiene el asiento y recibe un `checkoutUrl` de Stripe
  ```json
  {
    "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_...",
    "orderId": "order-uuid"
  }
  ```

- **Usuario 2**: Recibe error 409 Conflict
  ```json
  {
    "statusCode": 409,
    "message": "Seat is not available",
    "error": "Conflict"
  }
  ```

---

### Paso 4: Completar el Pago

#### Opción A: Usando Stripe CLI (Recomendado para Testing)

1. **Instalar Stripe CLI**: https://stripe.com/docs/stripe-cli

2. **Iniciar listener de webhooks**:
   ```bash
   stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
   ```

   Copia el `webhook signing secret` que aparece (empieza con `whsec_`) y agrégalo a tu `.env`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

3. **Simular pago exitoso**:
   ```bash
   stripe trigger checkout.session.completed
   ```

4. **Verificar en logs**: Deberías ver en la consola del servidor:
   ```
   [ConfirmPaymentUseCase] Order order-uuid paid (checkout cs_test_...); seat sold
   ```

   > `stripe trigger` crea una sesión propia sin `orderId` en los metadatos, así que solo sirve para comprobar que el webhook llega (se registra y se ignora). Para probar el flujo completo usa la opción B.

#### Opción B: Usando el Checkout de Stripe

1. Abre el `checkoutUrl` que recibiste en el navegador
2. Usa una tarjeta de prueba de Stripe:
   - **Número**: `4242 4242 4242 4242`
   - **Fecha**: Cualquier fecha futura
   - **CVC**: Cualquier 3 dígitos
   - **ZIP**: Cualquier código postal

3. Completa el pago

4. El webhook de Stripe confirmará automáticamente el pago

---

### Paso 5: Verificar en la Base de Datos

Accede a Adminer (http://localhost:8080) y ejecuta:

```sql
-- Ver todas las órdenes
SELECT * FROM "order";

-- Ver todos los pagos
SELECT * FROM payment;

-- Ver estado de los asientos
SELECT * FROM seat;
```

**Deberías ver:**
- Orden con `status = 'confirmed'`
- Pago con `status = 'paid'`
- Asiento con `status = 'sold'`

---

## Probar Expiración de Reservas

Las reservas sin pagar se liberan cuando pasan `RESERVATION_TTL_MINUTES` (15 por defecto). Un cron revisa cada minuto las órdenes caducadas: primero cierra la sesión de Stripe (así ya no se puede pagar) y después cancela la orden y libera el asiento.

### Prueba Manual

1. **Crear una reserva** (sin completar el pago):
   ```bash
   curl -X POST http://localhost:3000/api/v1/orders/SEAT_ID/book \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

2. **Esperar a que caduque** (para probar rápido, arranca con `RESERVATION_TTL_MINUTES=1`)

3. **Verificar en la base de datos**:
   ```sql
   SELECT * FROM payment WHERE status = 'cancelled';
   SELECT * FROM seat WHERE status = 'available';
   ```

---

## Testing Automatizado

```bash
# Ejecutar todos los tests
pnpm test

# Tests de payments
pnpm test payments

# Test con coverage
pnpm test:cov

# Comprobación de tipos y lint
pnpm typecheck
pnpm lint:check
```

---

## Endpoints Disponibles

Los endpoints marcados con 🔒 requieren la cabecera `x-api-key: <ADMIN_API_KEY>`.

### Eventos
- 🔒 `POST /api/v1/events` - Crear evento con asientos

### Asientos
- `GET /api/v1/seats/event/:event_id` - Obtener todos los asientos de un evento
- `GET /api/v1/seats/:seat_id` - Obtener detalle de un asiento

### Órdenes
- `POST /api/v1/orders/:seat_id/book` - Reservar asiento
  - Body (opcional): `{ "user_id": "uuid" }`
  - Si no se proporciona `user_id`, se genera uno aleatorio
- 🔒 `GET /api/v1/orders` - Listar todas las órdenes
- `GET /api/v1/orders/:order_id` - Obtener detalle de una orden

### Pagos
- `POST /api/v1/payments/process` - Obtener (o reintentar) el enlace de pago de una orden pendiente
  - Body: `{ "orderId": "uuid" }`
  - Si la orden ya tiene una sesión de Stripe abierta, devuelve la misma URL: nunca hay dos checkouts pagables para una orden
- 🔒 `POST /api/v1/payments/expire-reservations` - Liberar reservas caducadas (para Cloud Scheduler)

### Webhooks
- `POST /api/v1/webhooks/stripe` - Webhook de Stripe (uso interno)

---

## Troubleshooting

### Error: "Seat is not available"
- **Causa**: Otro usuario ya reservó o compró el asiento
- **Solución**: Intentar con otro asiento disponible

### Error: "Order ... is already paid"
- **Causa**: Intentando pagar una orden ya confirmada

### Error: "Order ... has expired or was cancelled"
- **Causa**: La reserva caducó antes de pagarse
- **Solución**: Crear una nueva reserva

### Error: "Invalid environment configuration"
- **Causa**: Falta una variable de entorno obligatoria o tiene un valor inválido
- **Solución**: Revisar `.env` contra `.env.example`

### Webhook no funciona
- **Causa**: `STRIPE_WEBHOOK_SECRET` incorrecto o no configurado
- **Solución**: 
  1. Ejecutar `stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe`
  2. Copiar el secret que aparece al `.env`
  3. Reiniciar el servidor

### Puerto 3000 en uso
```bash
# Matar proceso en puerto 3000
lsof -ti:3000 | xargs kill -9

# O cambiar puerto en .env
PORT=3001
```

---

## Notas Importantes

1. **UUIDs Aleatorios**: Si no proporcionas `user_id` en el body, el sistema genera uno automáticamente para facilitar las pruebas. No hay autenticación de usuarios finales: `user_id` es un dato informativo.

2. **Concurrencia**: El sistema usa bloqueo pesimista (`SELECT FOR UPDATE`) sobre el asiento al reservar y sobre la orden al confirmar o cancelar. Las transiciones solo se aplican si la orden sigue `pending`, así que webhooks duplicados, tardíos o simultáneos con la expiración no pueden dejar estados inconsistentes.

3. **Pagos tardíos**: Si llega un pago para una orden que ya se canceló, se reembolsa automáticamente.

4. **Stripe Test Mode**: Asegúrate de usar claves de **test** (empiezan con `sk_test_`), no claves de producción.

---

## Arquitectura

```
src/
├── events/          # Gestión de eventos
├── seats/           # Gestión de asientos
├── orders/          # Lógica de reservas (con transacciones)
├── payments/        # Integración con Stripe (arquitectura hexagonal)
│   ├── domain/      # Entidad Payment, errores y contrato del repositorio
│   ├── application/ # Casos de uso y puertos (pasarela de pago, reservas)
│   └── infrastructure/
│       ├── controllers/  # Pagos y webhooks
│       ├── filters/      # Errores de dominio -> HTTP
│       ├── gateways/     # StripeAdapter
│       ├── persistence/  # Repositorios TypeORM
│       └── schedulers/   # Cron de expiración
├── common/          # Guard de API key, transformers
├── config/          # Validación de variables de entorno
└── database/        # Opciones de conexión, data source del CLI y migraciones
```

---

## Licencia

MIT
