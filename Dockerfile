# Этап 1: Установка зависимостей
FROM python:3.10-slim AS builder

LABEL authors="kalinin"

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Устанавливаем системные зависимости и python-библиотеки в один слой
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Копируем только файлы с зависимостями для лучшего кеширования
COPY requirements.txt .

# Устанавливаем UV и Python-зависимости в изолированную директорию
RUN pip install --no-cache-dir uv && \
    uv pip install --no-cache-dir --system -r requirements.txt gunicorn==20.1.0

# Этап 2: Финальный минимальный образ
FROM python:3.10-slim AS final

LABEL authors="kalinin"

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app/securesight

# Копируем установленные зависимости из builder
COPY --from=builder /usr/local /usr/local

# Копируем оставшиеся файлы проекта
COPY . .

# Подготовка статических файлов
RUN python manage.py collectstatic --no-input

EXPOSE 8000

CMD ["gunicorn", "securesight.wsgi", "--bind=0.0.0.0:8000"]