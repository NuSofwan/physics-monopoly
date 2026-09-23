FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
COPY shared/package.json shared/package.json
RUN npm ci
COPY . .
ARG VITE_SERVER_URL
ARG VITE_API_URL
ENV VITE_SERVER_URL=$VITE_SERVER_URL VITE_API_URL=$VITE_API_URL
RUN npm run check && npm run test

FROM build AS service
RUN npm prune --omit=dev && mkdir -p /var/lib/physics/uploads && chown -R node:node /var/lib/physics
ENV NODE_ENV=production PORT=2567 PRIVATE_STORAGE_PATH=/var/lib/physics/uploads
USER node
EXPOSE 2567
CMD ["npm","run","start","-w","server"]

FROM nginx:stable-alpine AS web
COPY --from=build /app/client/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
