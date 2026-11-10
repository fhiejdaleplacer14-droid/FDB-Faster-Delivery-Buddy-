FROM composer:2.11.1 AS composer

FROM php:8.5.12-fpm-trixie AS base

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libpq-dev libicu-dev libzip-dev libpng-dev libjpeg62-turbo-dev libwebp-dev unzip git \
    && docker-php-ext-configure gd --with-jpeg --with-webp \
    && docker-php-ext-install -j"$(nproc)" pdo_pgsql pgsql intl zip bcmath gd pcntl \
    && rm -rf /var/lib/apt/lists/*

RUN docker-php-ext-install exif

COPY --from=composer /usr/bin/composer /usr/bin/composer
COPY docker/php/php.ini /usr/local/etc/php/conf.d/zz-fdb.ini

WORKDIR /var/www/html

ARG UID=1000
ARG GID=1000
RUN groupmod -o -g "${GID}" www-data && usermod -o -u "${UID}" www-data

FROM base AS development
USER www-data

FROM base AS production
COPY --chown=www-data:www-data backend/ /var/www/html/
RUN composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader
COPY docker/php/php.prod.ini /usr/local/etc/php/conf.d/zz-fdb-prod.ini
USER www-data
