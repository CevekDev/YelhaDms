FROM node:20-slim

WORKDIR /app
COPY package*.json ./
RUN npm install --ignore-scripts
COPY tsconfig.json ./
COPY server.ts ./
RUN npx tsc && npm prune --omit=dev

CMD ["node", "dist/server.js"]
