# Single image for both the API server and the campaign worker —
# docker-compose overrides the command for the worker service.
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts

EXPOSE 3000

CMD ["node", "src/server.js"]
