# ── Étape 1 : build Vite ──────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# ARG permet de passer VITE_API_URL au moment du build (docker compose build)
ARG VITE_API_URL=http://192.168.1.50:8030
ARG VITE_PUBLIC_URL=https://erh.camusatsn.com
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_PUBLIC_URL=$VITE_PUBLIC_URL

RUN npm run build

# ── Étape 2 : servir avec nginx ───────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
