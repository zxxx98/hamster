FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM nginx:1.27-alpine

RUN apk add --no-cache jq

COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/entrypoint.sh /usr/local/bin/hamster-entrypoint
COPY --from=build /app/dist /usr/share/nginx/html

RUN chmod +x /usr/local/bin/hamster-entrypoint

ENTRYPOINT ["/usr/local/bin/hamster-entrypoint"]
