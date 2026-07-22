FROM node:20-alpine AS builder
WORKDIR /app

# Build context is the monorepo root (not frontend/ alone) so this can see
# the ONE shared package-lock.json that covers both workspaces - frontend/
# deliberately has no lockfile of its own under npm workspaces, so `npm ci`
# only works run from here.
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
RUN npm ci

COPY frontend ./frontend
COPY shared ./shared
RUN cd frontend && npm run build

FROM nginx:alpine AS production

# Force a genuine rebuild of everything below this line. Railway's build
# cache has been observed serving a stale image even after new commits
# with real file changes - bumping this value invalidates that cache
# deterministically, since Docker always treats a changed ARG as a reason
# to rebuild every subsequent layer. Bump this number any time a deploy
# needs to be guaranteed fresh.
ARG CACHEBUST=2
RUN echo "cachebust: $CACHEBUST"

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
# Railway assigns PORT dynamically and routes traffic to exactly that port,
# regardless of what EXPOSE says - a hardcoded `listen 80` here would silently
# mismatch whatever port Railway actually expects, leaving the container
# "Active" but unreachable. This default is just a safety net for running
# the image somewhere PORT isn't set at all (e.g. testing it locally).
ENV PORT=8080
# "auto" let the container's (possibly misreported) CPU count decide how many
# workers to spawn - this observed ~48 workers for what's just static file
# serving. A small fixed number is both correct and far lighter.
RUN sed -i 's/worker_processes[^;]*;/worker_processes 2;/' /etc/nginx/nginx.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]