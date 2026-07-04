FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS dev
RUN npm ci
COPY . .
EXPOSE 3001
CMD ["node", "--watch", "server.js"]

FROM base AS production
RUN npm ci --omit=dev
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
