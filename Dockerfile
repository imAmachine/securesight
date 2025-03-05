FROM python:3.10

LABEL authors="kalinin"

ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Clone repository
RUN git clone https://github.com/Gerrux/securesight.git

WORKDIR /app/securesight/

# Install system dependencies first (if needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir gunicorn==20.1.0  # Explicit install

COPY . .

RUN python manage.py makemigrations
RUN python manage.py migrate
RUN python manage.py collectstatic --no-input

EXPOSE 8000

CMD ["gunicorn", "securesight.wsgi", "--bind=0.0.0.0:8000"]