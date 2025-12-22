FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV PORT=3001
ENV WS_PORT=8080

EXPOSE 3001 8080
CMD ["node", "universal-server.js"]
