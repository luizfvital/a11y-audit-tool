FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json

RUN npm ci --omit=dev --workspace @a11y-audit-platform/api

COPY apps/api/src apps/api/src
COPY openapi.yaml openapi.yaml

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace", "@a11y-audit-platform/api"]
