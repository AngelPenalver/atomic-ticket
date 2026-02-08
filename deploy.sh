#!/bin/bash
set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuración por defecto
PROJECT_ID=${1:-"atomic-ticket-prod"}
REGION=${2:-"us-central1"}
SERVICE_NAME="atomic-ticket"
IMAGE_NAME="us-central1-docker.pkg.dev/${PROJECT_ID}/atomic-ticket/app"

echo -e "${GREEN}=== Deployment a Google Cloud Run ===${NC}"
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"
echo ""

# Verificar que gcloud esté instalado
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI no está instalado${NC}"
    echo "Instalar desde: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Configurar proyecto
echo -e "${YELLOW}Configurando proyecto...${NC}"
gcloud config set project $PROJECT_ID

# Habilitar APIs necesarias
echo -e "${YELLOW}Habilitando APIs...${NC}"
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com

# Crear repositorio de Artifact Registry si no existe
echo -e "${YELLOW}Verificando Artifact Registry...${NC}"
if ! gcloud artifacts repositories describe atomic-ticket --location=$REGION &> /dev/null; then
    echo "Creando repositorio..."
    gcloud artifacts repositories create atomic-ticket \
      --repository-format=docker \
      --location=$REGION \
      --description="Atomic Ticket Docker images"
fi

# Configurar Docker para Artifact Registry
echo -e "${YELLOW}Configurando Docker...${NC}"
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Build de la imagen
echo -e "${YELLOW}Building imagen Docker...${NC}"
docker build -t ${IMAGE_NAME}:latest .

# Push a Artifact Registry
echo -e "${YELLOW}Pushing imagen a Artifact Registry...${NC}"
docker push ${IMAGE_NAME}:latest

# Deploy a Cloud Run
echo -e "${YELLOW}Deploying a Cloud Run...${NC}"
gcloud run deploy $SERVICE_NAME \
  --image ${IMAGE_NAME}:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300

# Obtener URL del servicio
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --format 'value(status.url)')

echo ""
echo -e "${GREEN}=== Deployment completado exitosamente ===${NC}"
echo -e "URL del servicio: ${GREEN}${SERVICE_URL}${NC}"
echo ""
echo -e "${YELLOW}Próximos pasos:${NC}"
echo "1. Configurar variables de entorno (secrets):"
echo "   gcloud run services update $SERVICE_NAME --region $REGION \\"
echo "     --set-env-vars=\"NODE_ENV=production,FRONTEND_URL=https://tu-frontend.com\""
echo ""
echo "2. Configurar webhook de Stripe:"
echo "   URL: ${SERVICE_URL}/api/v1/webhooks/stripe"
echo ""
echo "3. Test del servicio:"
echo "   curl ${SERVICE_URL}/api/v1/events"
