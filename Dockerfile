FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

RUN mkdir -p /data && chown node:node /data

ENV NODE_ENV=production
ENV DATABASE_PATH=/data/visits.db
ENV PORT=3000
ENV NODE_OPTIONS=--disable-warning=ExperimentalWarning

USER node
EXPOSE 3000
VOLUME /data

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:3000/').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
