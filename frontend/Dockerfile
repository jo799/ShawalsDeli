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
RUN cd frontend && npm run build

FROM nginx:alpine AS production
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]