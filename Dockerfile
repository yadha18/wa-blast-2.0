# Single-service build: React frontend is compiled, then served by the Express backend.
FROM node:22-slim AS client-build
WORKDIR /client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/src ./src
COPY --from=client-build /client/dist /app/client/dist
# Railway injects PORT; DATA_DIR must point at the mounted Volume (/data).
ENV DATA_DIR=/data
CMD ["node", "src/index.js"]
