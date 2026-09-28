.PHONY: dev prod down logs

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
