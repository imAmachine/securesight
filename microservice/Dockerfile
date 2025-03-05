# Используем официальный CUDA образ с минимальными зависимостями
FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

LABEL authors="kalinin"

# Установка переменных окружения
ENV DEBIAN_FRONTEND=noninteractive \
    TZ=UTC \
    CUDA_HOME=/usr/local/cuda \
    PATH=$CUDA_HOME/bin:$PATH \
    LD_LIBRARY_PATH=$CUDA_HOME/lib64:$LD_LIBRARY_PATH

# Установка зависимостей в одну команду для уменьшения слоев
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl wget git gnupg lsb-release \
    python3 python3-pip python3-dev build-essential \
    cuda-toolkit-12-1 cuda-runtime-12-1 cuda-cudart-dev-12-1 \
    libnvidia-container-tools \
    python3-libnvinfer python3-libnvinfer-dev \
    tensorrt \
    && rm -rf /var/lib/apt/lists/*

# Установка ключа и JNA в одной команде
RUN wget -O - https://nvidia.github.io/libnvidia-container/gpgkey | apt-key add - \
    && mkdir -p /usr/share/java \
    && wget -O /usr/share/java/jna-5.6.0.jar https://repo1.maven.org/maven2/net/java/dev/jna/jna/5.6.0/jna-5.6.0.jar

# Установка рабочей директории
WORKDIR /app

# Установка Python-зависимостей 
RUN pip3 install --no-cache-dir \
    packaging setuptools wheel ninja

# Копирование и установка requirements
COPY microservice/requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Установка PyTorch с поддержкой CUDA
RUN pip3 install --no-cache-dir \
    torch torchvision --extra-index-url https://download.pytorch.org/whl/cu121

# Клонирование и установка библиотек в одном слое
RUN git clone https://github.com/NVIDIA-AI-IOT/torch2trt \
    && cd torch2trt \
    && pip3 install -e . \
    && cd .. \
    && rm -rf torch2trt \
    && git clone https://github.com/NVIDIA-AI-IOT/trt_pose \
    && cd trt_pose \
    && python3 setup.py install \
    && cd .. \
    && rm -rf trt_pose

# Клонирование репозитория securesight
RUN git clone https://github.com/Gerrux/securesight.git \
    && mv securesight/microservice/* . \
    && rm -rf securesight

# Финальные обновления пакетов
RUN pip3 install --no-cache-dir --upgrade \
    sympy==1.13.1 \
    typing-extensions>=4.10.0 \
    pip setuptools wheel

# Открытие порта
EXPOSE 9000

# Команда запуска
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9000"]