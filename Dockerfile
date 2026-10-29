FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=80
WORKDIR /app
RUN addgroup -S reform && adduser -S -G reform -u 10001 reform
# The standalone output contains the server, the traced node_modules and lib/migrations.
COPY --from=build --chown=reform:reform /app/.next/standalone ./
COPY --from=build --chown=reform:reform /app/.next/static ./.next/static
COPY --from=build --chown=reform:reform /app/public ./public
USER reform
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/healthz" >/dev/null || exit 1
CMD ["node", "server.js"]
