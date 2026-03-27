FROM node:22.11.0-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY README.md LICENSE ./

RUN groupadd --gid 10001 app && useradd --uid 10001 --gid app --create-home app
USER app

ENTRYPOINT ["node", "src/index.mjs"]
