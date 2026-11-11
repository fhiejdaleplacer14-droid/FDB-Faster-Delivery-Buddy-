# API-only image for Render: nginx and PHP-FPM in one container, run as an unprivileged user.
# The website itself is served by Cloudflare; this container answers /api, /sanctum and /storage.
FROM composer:2.11.1 AS composer

FROM php:8.5.12-fpm-trixie

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        nginx supervisor gettext-base libpq-dev libicu-dev libzip-dev libpng-dev libjpeg62-turbo-dev libwebp-dev unzip git \
    && docker-php-ext-configure gd --with-jpeg --with-webp \
    && docker-php-ext-install -j"$(nproc)" pdo_pgsql pgsql intl zip bcmath gd pcntl exif \
    && rm -rf /var/lib/apt/lists/*

COPY docker/php/php.ini /usr/local/etc/php/conf.d/zz-fdb.ini
COPY docker/php/php.prod.ini /usr/local/etc/php/conf.d/zz-fdb-prod.ini
COPY docker/render/php-fpm.conf /usr/local/etc/php-fpm.d/zzz-render.conf
COPY docker/render/nginx.conf.template /etc/nginx/fdb.conf.template
COPY docker/render/supervisord.conf /etc/supervisor/fdb.conf
COPY --chmod=755 docker/render/entrypoint.sh /usr/local/bin/fdb-entrypoint

WORKDIR /var/www/html
COPY --from=composer /usr/bin/composer /usr/bin/composer
COPY backend/ /var/www/html/
RUN composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader --classmap-authoritative \
    && rm /usr/bin/composer \
    && mkdir -p storage/app/private storage/app/public storage/app/seller-documents \
        storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

USER www-data
# Render sets PORT (10000 by default).
ENV PORT=10000
EXPOSE 10000
ENTRYPOINT ["fdb-entrypoint"]
CMD ["supervisord", "-c", "/etc/supervisor/fdb.conf"]
