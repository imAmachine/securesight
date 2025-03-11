# Этап 1: Сборка зависимостей и установка Python-библиотек
FROM python:3.10-slim AS builder
LABEL authors="kalinin"

# Устанавливаем переменные окружения для оптимизации работы Python
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Объединяем обновление и установку необходимых пакетов в один слой для лучшего кэширования.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    ffmpeg \
  && rm -rf /var/lib/apt/lists/*

# Копируем файл зависимостей отдельно для использования кэша при изменении исходников
COPY requirements.txt .

# Устанавливаем uv и Python-зависимости в системное окружение
RUN pip install --no-cache-dir uv && \
    uv pip install --no-cache-dir --system -r requirements.txt gunicorn==20.1.0

# Этап 2: Финальный минимальный образ
FROM python:3.10-slim AS final
LABEL authors="kalinin"

# Runtime-переменные окружения
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app/securesight

# Устанавливаем минимальные runtime‑зависимости (ffmpeg) — apt‑пакеты не переносятся из builder
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Переносим установленные Python‑библиотеки из builder-стадии
COPY --from=builder /usr/local /usr/local

# Копируем исходники проекта (чувствительные к изменениям файлы — копируем после зависимостей для лучшего кеширования)
COPY . .

# Подготовка статических файлов (опционально, если используется Django)
RUN python manage.py collectstatic --no-input

EXPOSE 8000

CMD ["gunicorn", "securesight.wsgi", "--bind=0.0.0.0:8000"]
