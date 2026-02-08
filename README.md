# Atomic Ticket - Sistema de Reservas con Stripe

Sistema de reservas de tickets con control de concurrencia y pagos mediante Stripe.

## Características

- Control de Concurrencia: Solo un usuario puede reservar un asiento específico
- Pagos con Stripe: Integración completa con Stripe Checkout
- Webhooks: Confirmación automática de pagos
- Expiración Automática: Pagos pendientes se cancelan después de 15 minutos
- Transacciones: Garantía de consistencia en la base de datos

---

## Setup Inicial

### 1. Requisitos Previos

- Node.js 18+
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

# Levantar base de datos con Docker
docker-compose up -d

# Copiar variables de entorno
cp .env.example .env
```

### 3. Configurar Stripe

Edita el archivo `.env`:

```bash
# Obtén tu clave secreta en: https://dashboard.stripe.com/test/apikeys
STRIPE_SECRET_KEY=sk_test_tu_clave_aqui

# Para webhooks locales (ver sección de Webhooks)
STRIPE_WEBHOOK_SECRET=whsec_tu_secret_aqui

# URL del frontend (para redirecciones de Stripe)
FRONTEND_URL=http://localhost:3000
```

### 4. Iniciar Aplicación

```bash
# Modo desarrollo
pnpm run start:dev

# La API estará disponible en: http://localhost:3000/api/v1
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

Consulta en Adminer o usando psql:

```sql
SELECT id, number, status 
FROM seat 
WHERE event_id = 'TU_EVENT_ID' 
AND status = 'available' 
LIMIT 1;
```

Guarda el `id` del asiento para el siguiente paso.

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
  -d '{}' &
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
   [NestApplication] Payment confirmed for order: order-uuid
   [NestApplication] Order order-uuid confirmed and seat finalized.
   ```

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

## Probar Expiración de Pagos

Los pagos pendientes se cancelan automáticamente después de 15 minutos.

### Prueba Manual

1. **Crear una reserva** (sin completar el pago):
   ```bash
   curl -X POST http://localhost:3000/api/v1/orders/SEAT_ID/book \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

2. **Esperar 15 minutos** (o modificar temporalmente el tiempo en `payment-cleanup.cron.ts`)

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
```

---

## Endpoints Disponibles

### Eventos
- `POST /api/v1/events` - Crear evento con asientos

### Órdenes
- `POST /api/v1/orders/:seat_id/book` - Reservar asiento
  - Body (opcional): `{ "user_id": "uuid" }`
  - Si no se proporciona `user_id`, se genera uno aleatorio

### Pagos
- `POST /api/v1/payments/process` - Procesar pago manualmente
  - Body: `{ "orderId": "uuid" }`

### Webhooks
- `POST /api/v1/webhooks/stripe` - Webhook de Stripe (uso interno)

---

## Troubleshooting

### Error: "Seat is already locked"
- **Causa**: Otro usuario ya reservó el asiento
- **Solución**: Intentar con otro asiento disponible

### Error: "This order is already paid"
- **Causa**: Intentando pagar una orden ya confirmada
- **Solución**: Crear una nueva reserva

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

1. **UUIDs Aleatorios**: Si no proporcionas `user_id` en el body, el sistema genera uno automáticamente para facilitar las pruebas.

2. **Concurrencia**: El sistema usa bloqueo pesimista (`SELECT FOR UPDATE`) para garantizar que solo un usuario pueda reservar un asiento.

3. **Stripe Test Mode**: Asegúrate de usar claves de **test** (empiezan con `sk_test_`), no claves de producción.

4. **Expiración**: Los pagos pendientes se cancelan automáticamente cada 15 minutos mediante un cron job.

---

## Arquitectura

```
src/
├── events/          # Gestión de eventos
├── seats/           # Gestión de asientos
├── orders/          # Lógica de reservas (con transacciones)
├── payments/        # Integración con Stripe
│   ├── application/ # Use cases
│   ├── domain/      # Entidades y schedulers
│   └── infrastructure/
│       ├── controllers/  # Webhooks
│       ├── gateways/     # StripeAdapter
│       └── persistence/  # Repositorios
```

---

## Licencia

MIT
