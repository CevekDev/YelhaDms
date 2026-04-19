FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/* \
 && git config --global url."https://github.com/".insteadOf "ssh://git@github.com/"

WORKDIR /app
COPY package*.json ./
RUN npm install --ignore-scripts
COPY tsconfig.json ./
COPY server.ts ./
RUN npx tsc && npm prune --omit=dev

CMD ["node", "dist/server.js"]
