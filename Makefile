.PHONY: dev prod down logs bf bf-down

# Mac / dev local (après : cp docker-compose.dev.yml docker-compose.override.yml)
dev:
	git pull origin main
	docker compose up -d --build

# Serveur de production
prod:
	git pull origin main
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f frontend

# ── Burkina Faso en local (à côté du Sénégal) — lancer d'abord « make bf » dans le backend
bf:
	docker compose -f docker-compose.bf-local.yml up -d --build
	@echo "Plateforme Burkina : http://localhost:8081"

bf-down:
	docker compose -f docker-compose.bf-local.yml down
