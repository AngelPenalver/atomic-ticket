# Deployment a Google Cloud Platform

## Guía Rápida de Deployment

### Prerrequisitos

1. **Instalar Google Cloud CLI**
   ```bash
   # Linux/macOS
   curl https://sdk.cloud.google.com | bash
   exec -l $SHELL
   
   # Inicializar
   gcloud init
   ```

2. **Crear Proyecto en GCP**
   - Ir a: https://console.cloud.google.com
   - Crear nuevo proyecto o usar uno existente
   - Habilitar facturación (free tier de $300 es suficiente)

---

## Opción 1: Deployment Automático (Recomendado)

### Paso 1: Configurar Proyecto

```bash
# Configurar proyecto activo
gcloud config set project TU_PROJECT_ID

# Habilitar APIs necesarias
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudscheduler.googleapis.com
```

### Paso 2: Crear Base de Datos (Cloud SQL)

```bash
# Crear instancia PostgreSQL
gcloud sql instances create atomic-ticket-db \
  --database-version=POSTGRES_17 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --root-password=TU_PASSWORD_SEGURO

# Crear base de datos
gcloud sql databases create atomic_ticket \
  --instance=atomic-ticket-db

# Crear usuario
gcloud sql users create appuser \
  --instance=atomic-ticket-db \
  --password=TU_PASSWORD_SEGURO
```

### Paso 3: Configurar Secrets

```bash
# Stripe Secret Key
echo -n "sk_test_tu_clave" | \
  gcloud secrets create stripe-secret-key --data-file=-

# Stripe Webhook Secret
echo -n "whsec_tu_secret" | \
  gcloud secrets create stripe-webhook-secret --data-file=-

# Database URL (socket de Cloud SQL)
echo -n "postgresql://appuser:password@/atomic_ticket?host=/cloudsql/TU_PROJECT_ID:us-central1:atomic-ticket-db" | \
  gcloud secrets create database-url --data-file=-

# API key para endpoints de administración (crear eventos, listar órdenes, expirar reservas)
openssl rand -hex 32 | tr -d '\n' | \
  gcloud secrets create admin-api-key --data-file=-
```

Dar acceso a los secrets a la cuenta de servicio de Cloud Run:

```bash
PROJECT_NUMBER=$(gcloud projects describe TU_PROJECT_ID --format='value(projectNumber)')
for secret in stripe-secret-key stripe-webhook-secret database-url admin-api-key; do
  gcloud secrets add-iam-policy-binding $secret \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

> El esquema de base de datos se crea con migraciones que se ejecutan automáticamente al arrancar la aplicación. No hace falta ningún paso manual.

### Paso 4: Deploy

```bash
# Ejecutar script de deployment
./deploy.sh TU_PROJECT_ID https://tu-frontend.com us-central1 atomic-ticket-db
```

El script comprueba que existan los secrets, construye la imagen etiquetada con el commit actual y despliega con Cloud SQL, secrets y variables de entorno.

---

## Opción 2: Deployment Manual

### Build y Push de Imagen

```bash
# Configurar proyecto
export PROJECT_ID=tu-project-id
export REGION=us-central1

# Crear repositorio
gcloud artifacts repositories create atomic-ticket \
  --repository-format=docker \
  --location=$REGION

# Configurar Docker
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Build
export TAG=$(git rev-parse --short HEAD)
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/atomic-ticket/app:${TAG} .

# Push
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/atomic-ticket/app:${TAG}
```

### Deploy a Cloud Run

```bash
gcloud run deploy atomic-ticket \
  --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/atomic-ticket/app:${TAG} \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --add-cloudsql-instances ${PROJECT_ID}:${REGION}:atomic-ticket-db \
  --set-secrets="STRIPE_SECRET_KEY=stripe-secret-key:latest,STRIPE_WEBHOOK_SECRET=stripe-webhook-secret:latest,DATABASE_URL=database-url:latest,ADMIN_API_KEY=admin-api-key:latest" \
  --set-env-vars="NODE_ENV=production,FRONTEND_URL=https://tu-frontend.com" \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10
```

---

## Configurar Webhooks de Stripe

### Obtener URL del Servicio

```bash
gcloud run services describe atomic-ticket \
  --platform managed \
  --region us-central1 \
  --format 'value(status.url)'
```

### Configurar en Stripe Dashboard

1. Ir a: https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. URL: `https://tu-cloud-run-url/api/v1/webhooks/stripe`
4. Eventos: `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
5. Copiar el signing secret y actualizar:
   ```bash
   echo -n "whsec_nuevo_secret" | \
     gcloud secrets versions add stripe-webhook-secret --data-file=-
   ```

---

## Expiración de Reservas (Cloud Scheduler)

Con `--min-instances 0`, Cloud Run no ejecuta el cron interno mientras no hay tráfico. Para liberar los asientos a tiempo, Cloud Scheduler llama cada minuto al endpoint de expiración:

```bash
SERVICE_URL=$(gcloud run services describe atomic-ticket --region us-central1 --format 'value(status.url)')

gcloud scheduler jobs create http atomic-ticket-expire-reservations \
  --location us-central1 \
  --schedule "* * * * *" \
  --http-method POST \
  --uri "${SERVICE_URL}/api/v1/payments/expire-reservations" \
  --headers "x-api-key=$(gcloud secrets versions access latest --secret=admin-api-key)"
```

Como red de seguridad, cada sesión de Stripe caduca sola a los ~30 minutos (el mínimo que permite Stripe) y el webhook `checkout.session.expired` libera el asiento aunque el job no se haya ejecutado.

---

## Variables de Entorno

### Requeridas

```bash
NODE_ENV=production
PORT=8080  # Cloud Run lo configura automáticamente
FRONTEND_URL=https://tu-frontend.com

# Desde Secret Manager
STRIPE_SECRET_KEY=<secret>
STRIPE_WEBHOOK_SECRET=<secret>
DATABASE_URL=<secret>
ADMIN_API_KEY=<secret>
```

### Opcionales

```bash
RESERVATION_TTL_MINUTES=15  # Minutos que un asiento queda bloqueado esperando el pago
```

La aplicación valida todas las variables al arrancar y no inicia si falta alguna o tiene un valor inválido.

### Actualizar Variables

```bash
gcloud run services update atomic-ticket \
  --region us-central1 \
  --set-env-vars="FRONTEND_URL=https://nuevo-frontend.com"
```

---

## Monitoreo y Logs

### Ver Logs

```bash
# Logs recientes
gcloud run services logs read atomic-ticket --region us-central1

# Logs en tiempo real
gcloud run services logs tail atomic-ticket --region us-central1

# Logs con filtro
gcloud run services logs read atomic-ticket \
  --region us-central1 \
  --filter="severity>=ERROR"
```

### Ver Métricas

```bash
# Abrir consola de Cloud Run
gcloud run services describe atomic-ticket \
  --region us-central1 \
  --format="value(status.url)"
```

O ir a: https://console.cloud.google.com/run

---

## Verificación Post-Deployment

### Test de Health Check

```bash
# Obtener URL
SERVICE_URL=$(gcloud run services describe atomic-ticket \
  --region us-central1 \
  --format 'value(status.url)')

ADMIN_API_KEY=$(gcloud secrets versions access latest --secret=admin-api-key)

# Crear evento de prueba
curl -X POST $SERVICE_URL/api/v1/events \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -d '{
    "name": "Test Event",
    "description": "Testing deployment",
    "date": "2026-12-31T20:00:00Z",
    "total_tickets": 1,
    "price": 10
  }'
```

---

## Rollback

### Listar Revisiones

```bash
gcloud run revisions list \
  --service atomic-ticket \
  --region us-central1
```

### Rollback a Revisión Anterior

```bash
gcloud run services update-traffic atomic-ticket \
  --to-revisions REVISION_NAME=100 \
  --region us-central1
```

---

## Costos Estimados (Free Tier)

Con el free tier de Google Cloud ($300 por 90 días):

- **Cloud Run**: Gratis hasta 2 millones de requests/mes
- **Cloud SQL (db-f1-micro)**: ~$7-10/mes
- **Artifact Registry**: 0.5 GB gratis/mes
- **Secret Manager**: Gratis hasta 6 secrets
- **Cloud Scheduler**: Gratis hasta 3 jobs

**Total estimado: $7-10/mes** (después del free tier)

---

## Troubleshooting

### Error: "Permission denied"

```bash
# Dar permisos al service account
gcloud projects add-iam-policy-binding TU_PROJECT_ID \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/cloudsql.client"
```

### Error: "Cannot connect to Cloud SQL"

Verificar que el Cloud SQL Proxy esté configurado:
```bash
gcloud run services update atomic-ticket \
  --add-cloudsql-instances PROJECT_ID:REGION:INSTANCE_NAME \
  --region us-central1
```

### Error: "Secret not found"

Verificar que los secrets existan:
```bash
gcloud secrets list
```

---

## CI/CD con Cloud Build (Opcional)

### Deployment Automático

```bash
# Deploy usando Cloud Build (typecheck + lint + tests + build + deploy)
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=SHORT_SHA=$(git rev-parse --short HEAD),_FRONTEND_URL=https://tu-frontend.com
```

La cuenta de servicio de Cloud Build necesita los roles `roles/run.admin` y `roles/iam.serviceAccountUser`.

### Trigger Automático desde GitHub

1. Conectar repositorio en Cloud Build
2. Crear trigger para branch `main`
3. Cada push deployará automáticamente

---

## Comandos Útiles

```bash
# Ver estado del servicio
gcloud run services describe atomic-ticket --region us-central1

# Actualizar imagen
gcloud run services update atomic-ticket \
  --image NEW_IMAGE \
  --region us-central1

# Escalar manualmente
gcloud run services update atomic-ticket \
  --min-instances 1 \
  --max-instances 5 \
  --region us-central1

# Eliminar servicio
gcloud run services delete atomic-ticket --region us-central1
```
