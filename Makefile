.PHONY: dev prod down logs

# Mac / dev local : frontend Docker branché sur le backend local (localhost:8030)
dev:
	git pull --ff-only
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# Serveur de production : build npm (mode sn) dans dist/
prod:
	bash scripts/deploy.sh

down:
	docker compose down

logs:
	docker compose logs -f frontend
