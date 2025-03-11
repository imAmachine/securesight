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

# Установка базовых системных зависимостей
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl wget git lsb-release \
    python3-pip python3-dev build-essential \
    libgl1 libglib2.0-0 \
    && mkdir -p /usr/share/java \
    && wget -O /usr/share/java/jna-5.6.0.jar https://repo1.maven.org/maven2/net/java/dev/jna/jna/5.6.0/jna-5.6.0.jar \
    && pip3 install --no-cache-dir uv \
    && rm -rf /var/lib/apt/lists/* /root/.cache/pip

# Этап 2: Python dependencies
FROM base AS python-deps

# Копирование и установка зависимостей с разделением на базовые и основные
COPY microservice/requirements.txt .
RUN uv pip install --system \
    packaging setuptools wheel ninja \
    --no-cache-dir \
    --cache-dir ${UV_CACHE_DIR} \
    && uv pip install --system \
    -r requirements.txt \
    --no-cache-dir \
    --cache-dir ${UV_CACHE_DIR}

# Этап 3: Репозитории и ML зависимости
FROM python-deps AS repo-cache
ARG TORCH_VERSION=2.3.0+cu118
ARG TORCHVISION_VERSION=0.18.0+cu118

# Установка PyTorch с явным указанием версий
RUN uv pip install --system \
    torch==${TORCH_VERSION} \
    torchvision==${TORCHVISION_VERSION} \
    --extra-index-url https://download.pytorch.org/whl/cu118 \
    --no-cache-dir \
    --cache-dir ${UV_CACHE_DIR}

# Клонирование репозиториев
RUN git clone --depth=1 https://github.com/NVIDIA-AI-IOT/torch2trt && \
    git clone --depth=1 https://github.com/NVIDIA-AI-IOT/trt_pose

# Этап 4: Сборка ML компонентов
FROM repo-cache AS ml-build

# Установка библиотек с параллельной сборкой
RUN cd torch2trt && \
    uv pip install --system -e . --no-build-isolation \
    && cd ../trt_pose && \
    uv pip install --system -e . --no-build-isolation

# Финализация зависимостей
RUN uv pip install --system --no-cache-dir --upgrade \
    sympy==1.13.1 \
    typing-extensions>=4.10.0

# Этап 5: Финальный образ
FROM nvcr.io/nvidia/tensorrt:23.12-py3 AS final

WORKDIR /app

# Копирование артефактов из предыдущего этапа
COPY --from=ml-build /usr/local/lib/python3.10/dist-packages /usr/local/lib/python3.10/dist-packages
COPY --from=ml-build /app/torch2trt /app/torch2trt
COPY --from=ml-build /app/trt_pose /app/trt_pose
COPY microservice/ .

# Устанавка Uvicorn в финальном образе
RUN uv pip install --system --no-cache-dir uvicorn

EXPOSE 9000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9000"]