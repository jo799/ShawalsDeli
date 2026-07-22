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

# Vite bakes VITE_* variables into the compiled bundle at build time, not
# read at runtime the way a normal backend env var would be. Since this
# build now happens inside the Docker build itself, Railway's dashboard
# Variables aren't visible here unless explicitly declared as a build ARG -
# this is that declaration, plus exporting it as a real env var so the
# `npm run build` step below actually sees it.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN cd frontend && npm run build

FROM nginx:alpine AS production

# Force a genuine rebuild of everything below this line. Railway's build
# cache has been observed serving a stale image even after new commits
# with real file changes - bumping this value invalidates that cache
# deterministically, since Docker always treats a changed ARG as a reason
# to rebuild every subsequent layer. Bump this number any time a deploy
# needs to be guaranteed fresh.
ARG CACHEBUST=4
RUN echo "cachebust: $CACHEBUST"

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
# "auto" let the container's (possibly misreported) CPU count decide how many
# workers to spawn - this observed ~48 workers for what's just static file
# serving. A small fixed number is both correct and far lighter.
RUN sed -i 's/worker_processes[^;]*;/worker_processes 2;/' /etc/nginx/nginx.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]