# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY ./src ./src
COPY tsconfig.json ./
RUN npx tsc -p tsconfig.json || true

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json
USER node
EXPOSE 3091
HEALTHCHECK --interval=15s --timeout=3s --retries=4 \
  CMD wget -qO- http://localhost:3091/healthz >/dev/null 2>&1 || exit 1
CMD ["node", "src/server.js"]
