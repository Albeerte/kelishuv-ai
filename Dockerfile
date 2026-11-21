FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund && npx prisma generate
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build && mkdir -p /app/.data && chown -R node:node /app/.data
USER node
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push && npx next start -H 0.0.0.0 -p 3000"]
