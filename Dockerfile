FROM python:3.10-slim

LABEL authors="kalinin"

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app/securesight

# Установка системных зависимостей в один слой
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*


# Копирование файлов проекта
COPY . .

# Установка зависимостей
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir gunicorn==20.1.0

# Подготовка базы данных и статических файлов в одном слое
RUN python manage.py makemigrations \
    && python manage.py makemigrations authapi videoanalytics \
    && python manage.py migrate \
    && python manage.py collectstatic --no-input

EXPOSE 8000

CMD ["gunicorn", "securesight.wsgi", "--bind=0.0.0.0:8000"]