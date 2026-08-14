# ── Étape 1 : build Vite ──────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# VITE_API_URL="" → URLs relatives, nginx proxifie /api/ → backend
# VITE_PUBLIC_URL = URL publique du frontend (ex. https://erh.camusatsn.com)
# Les valeurs réelles sont passées via docker-compose build args (lus depuis .env)
ARG VITE_API_URL=""
ARG VITE_PUBLIC_URL=""
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_PUBLIC_URL=$VITE_PUBLIC_URL

RUN npm run build

# ── Étape 2 : servir avec nginx ───────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Template nginx : BACKEND_URL est remplacé par envsubst au démarrage
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80

# envsubst substitue seulement ${BACKEND_URL} (les variables nginx $uri, $host…
# restent intactes car elles ne figurent pas dans la liste passée en argument)
CMD ["/bin/sh", "-c", \
  "envsubst '${BACKEND_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
