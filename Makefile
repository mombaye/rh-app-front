.PHONY: dev prod down logs

# Mac / dev local : frontend branché sur le backend local (localhost:8030)
dev:
	git pull --ff-only
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# Serveur de production
prod:
	git pull --ff-only
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f frontend
