# Production web server: the built SPA plus a front door for the Laravel API.
FROM node:24.22.2-alpine AS spa
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# Public origin of product photos when they move to a CDN; empty keeps them on this site.
ARG VITE_MEDIA_ORIGIN=""
ENV VITE_MEDIA_ORIGIN=${VITE_MEDIA_ORIGIN}
RUN npm run build

FROM nginx:1.30.6-alpine
COPY docker/nginx/production.conf /etc/nginx/conf.d/default.conf
COPY --from=spa /app/dist /usr/share/nginx/spa
# Placeholder index.php for nginx; media is owned by uid 1000 to match the app's www-data.
RUN mkdir -p /var/www/html/public /var/www/media && touch /var/www/html/public/index.php \
    && chown 1000:1000 /var/www/media
