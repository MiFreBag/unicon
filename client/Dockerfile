# Build stage
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY tailwind.config.js postcss.config.js vite.config.js ./
COPY src ./src
COPY public ./public

RUN npm ci
RUN npm run build

# Runtime stage
FROM nginx:1.27-alpine

COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html/unicon

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
