# Этап 1: Base dependencies
FROM nvcr.io/nvidia/tensorrt:23.12-py3 AS base

# Установка переменных окружения для CUDA и других параметров
ENV DEBIAN_FRONTEND=noninteractive \
    TZ=UTC \
    UV_HTTP_TIMEOUT=600 \
    UV_CACHE_DIR=/app/.uv_cache \
    PATH=/usr/local/cuda/bin:$PATH \
    CUDA_INC_DIR=/usr/local/cuda/include \
    CUDA_LIB_DIR=/usr/local/cuda/lib64

WORKDIR /app

# Установка базовых системных зависимостей и кастомного pip-обёртки "uv"
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl wget git lsb-release \
    python3-pip python3-dev build-essential \
    libgl1-mesa-glx libglib2.0-0 \
    && mkdir -p /usr/share/java \
    && wget -O /usr/share/java/jna-5.6.0.jar \
         https://repo1.maven.org/maven2/net/java/dev/jna/jna/5.6.0/jna-5.6.0.jar \
    && pip3 install --no-cache-dir uv \
    && rm -rf /var/lib/apt/lists/* /root/.cache/pip

# -----------------------------------------------------------------------------
# Этап 2: Python dependencies
FROM base AS python-deps

# Копирование файла зависимостей Python
COPY microservice/requirements.txt .

# Установка дополнительных пакетов и зависимостей из requirements.txt
RUN uv pip install --system --no-cache-dir \
    packaging setuptools wheel ninja && \
    uv pip install --system --no-cache-dir -r requirements.txt

# -----------------------------------------------------------------------------
# Этап 3: Репозитории и ML зависимости
FROM python-deps AS repo-cache
ARG TORCH_VERSION=2.3.0+cu118
ARG TORCHVISION_VERSION=0.18.0+cu118

# Установка PyTorch с нужными версиями
RUN uv pip install --system --no-cache-dir \
    torch==${TORCH_VERSION} torchvision==${TORCHVISION_VERSION} \
    --extra-index-url https://download.pytorch.org/whl/cu118

# Клонирование ML репозиториев в рабочую директорию (/app)
RUN git clone --depth=1 https://github.com/NVIDIA-AI-IOT/torch2trt && \
    git clone --depth=1 https://github.com/NVIDIA-AI-IOT/trt_pose

# -----------------------------------------------------------------------------
# Этап 4: Сборка ML компонентов и генерация wheel-архивов
FROM repo-cache AS ml-build

# Объединяем сборку wheel-файлов для torch2trt и trt_pose в один RUN-команду
RUN mkdir -p /wheels && \
    for repo in torch2trt trt_pose; do \
        cd $repo && \
        python setup.py bdist_wheel && \
        cp dist/*.whl /wheels/ && \
        cd ..; \
    done

# -----------------------------------------------------------------------------
# Этап 5: Финальный образ
FROM nvcr.io/nvidia/tensorrt:23.12-py3 AS final

# Системные библиотеки, необходимые для корректной работы OpenCV (cv2)
RUN apt-get update && apt-get install -y --no-install-recommends libgl1-mesa-glx && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем файл с зависимостями и исходники
COPY microservice/requirements.txt .
COPY --from=ml-build /wheels /wheels
COPY microservice/ .

ARG TORCH_VERSION=2.3.0+cu118
ARG TORCHVISION_VERSION=0.18.0+cu118

# Объединяем установку зависимостей в один RUN для уменьшения числа слоёв
RUN pip3 install uv && \
    uv pip install --system -r requirements.txt && \
    uv pip install --system torch==${TORCH_VERSION} \
         torchvision==${TORCHVISION_VERSION} \
         --extra-index-url https://download.pytorch.org/whl/cu118 && \
    pip3 install /wheels/*.whl && \
    uv pip install --system uvicorn

# Создаем непользовательский аккаунт для повышения безопасности
RUN useradd -m appuser && chown -R appuser /app
USER appuser

EXPOSE 9000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9000"]
