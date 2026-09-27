# Vite bakes VITE_* env vars in at BUILD time, not container start time —
# so they're passed as build args here, not as regular environment
# variables on the running container.
FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_BASE_URL
ARG VITE_META_APP_ID
ARG VITE_META_CONFIG_ID
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_META_APP_ID=$VITE_META_APP_ID \
    VITE_META_CONFIG_ID=$VITE_META_CONFIG_ID

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
