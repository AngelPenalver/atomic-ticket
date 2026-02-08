# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml ./

# Instalar pnpm y dependencias
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copiar código fuente
COPY . .

# Build de la aplicación
RUN pnpm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml ./

# Instalar TODAS las dependencias (no solo prod)
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copiar el build desde el stage anterior
COPY --from=builder /app/dist ./dist

# Exponer puerto (Cloud Run usa PORT env var)
EXPOSE 8080

# Usuario no-root por seguridad
USER node

# Comando de inicio
CMD ["node", "dist/main"]
