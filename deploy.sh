#!/usr/bin/env bash
set -euo pipefail

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

usage() {
    echo "Uso: $0 <PROJECT_ID> <FRONTEND_URL> [REGION] [SQL_INSTANCE]"
    echo "Ejemplo: $0 atomic-ticket-prod https://tickets.example.com us-central1 atomic-ticket-db"
    exit 1
}

[[ $# -ge 2 ]] || usage

PROJECT_ID=$1
FRONTEND_URL=$2
REGION=${3:-"us-central1"}
SQL_INSTANCE=${4:-"atomic-ticket-db"}
SERVICE_NAME="atomic-ticket"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/atomic-ticket/app"
TAG=$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)
REQUIRED_SECRETS=(stripe-secret-key stripe-webhook-secret database-url admin-api-key)

echo -e "${GREEN}=== Deployment a Google Cloud Run ===${NC}"
echo "Project ID:   $PROJECT_ID"
echo "Region:       $REGION"
echo "Service:      $SERVICE_NAME"
echo "SQL instance: $SQL_INSTANCE"
echo "Image tag:    $TAG"
echo ""

for tool in gcloud docker; do
    if ! command -v "$tool" &> /dev/null; then
        echo -e "${RED}Error: $tool no está instalado${NC}"
        exit 1
    fi
done

echo -e "${YELLOW}Configurando proyecto...${NC}"
gcloud config set project "$PROJECT_ID"

echo -e "${YELLOW}Habilitando APIs...${NC}"
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com

echo -e "${YELLOW}Verificando secrets...${NC}"
for secret in "${REQUIRED_SECRETS[@]}"; do
    if ! gcloud secrets describe "$secret" &> /dev/null; then
        echo -e "${RED}Error: falta el secret '$secret' (ver DEPLOYMENT.md, paso 3)${NC}"
        exit 1
    fi
done

echo -e "${YELLOW}Verificando Artifact Registry...${NC}"
if ! gcloud artifacts repositories describe atomic-ticket --location="$REGION" &> /dev/null; then
    gcloud artifacts repositories create atomic-ticket \
      --repository-format=docker \
      --location="$REGION" \
      --description="Atomic Ticket Docker images"
fi

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

echo -e "${YELLOW}Building imagen Docker...${NC}"
docker build -t "${IMAGE_NAME}:${TAG}" -t "${IMAGE_NAME}:latest" .

echo -e "${YELLOW}Pushing imagen a Artifact Registry...${NC}"
docker push --all-tags "${IMAGE_NAME}"

echo -e "${YELLOW}Deploying a Cloud Run...${NC}"
gcloud run deploy "$SERVICE_NAME" \
  --image "${IMAGE_NAME}:${TAG}" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300 \
  --add-cloudsql-instances "${PROJECT_ID}:${REGION}:${SQL_INSTANCE}" \
  --set-secrets "STRIPE_SECRET_KEY=stripe-secret-key:latest,STRIPE_WEBHOOK_SECRET=stripe-webhook-secret:latest,DATABASE_URL=database-url:latest,ADMIN_API_KEY=admin-api-key:latest" \
  --set-env-vars "NODE_ENV=production,FRONTEND_URL=${FRONTEND_URL}"

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --platform managed \
  --region "$REGION" \
  --format 'value(status.url)')

echo ""
echo -e "${GREEN}=== Deployment completado ===${NC}"
echo -e "URL del servicio: ${GREEN}${SERVICE_URL}${NC}"
echo ""
echo -e "${YELLOW}Próximos pasos (solo la primera vez):${NC}"
echo "1. Webhook de Stripe: ${SERVICE_URL}/api/v1/webhooks/stripe"
echo "2. Job de Cloud Scheduler para expirar reservas (ver DEPLOYMENT.md)"
