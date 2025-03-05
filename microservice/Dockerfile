# Use the official CUDA 12.1 image with Ubuntu 22.04 as the base image
FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04
LABEL authors="kalinin"

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# Update packages and install necessary dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    gnupg \
    lsb-release \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    cuda-toolkit-12-1 \
    cuda-runtime-12-1 \
    cuda-cudart-dev-12-1 \
    && rm -rf /var/lib/apt/lists/*

# Set CUDA paths
ENV CUDA_HOME=/usr/local/cuda
ENV PATH=$CUDA_HOME/bin:$PATH
ENV LD_LIBRARY_PATH=$CUDA_HOME/lib64:$LD_LIBRARY_PATH

# Add the NVIDIA TensorRT GPG key and install JNA
RUN wget -O - https://nvidia.github.io/libnvidia-container/gpgkey | apt-key add - && \
    wget https://repo1.maven.org/maven2/net/java/dev/jna/jna/5.6.0/jna-5.6.0.jar && \
    mkdir -p /usr/share/java && mv jna-5.6.0.jar /usr/share/java/

# Install TensorRT
RUN apt-get update && apt-get install -y \
    libnvidia-container-tools \
    python3-libnvinfer \
    python3-libnvinfer-dev \
    tensorrt \
    && rm -rf /var/lib/apt/lists/*

# Create app directory and set working directory
WORKDIR /app

# Install necessary Python packages
RUN pip3 install packaging setuptools wheel ninja

# Копируем requirements и устанавливаем
COPY requirements.txt .
RUN pip3 install -r requirements.txt

# Install PyTorch with CUDA support
RUN pip3 install torch torchvision --extra-index-url https://download.pytorch.org/whl/cu121

# Clone and install torch2trt (without plugins to avoid compilation issues)
RUN git clone https://github.com/NVIDIA-AI-IOT/torch2trt && \
    cd torch2trt && \
    pip3 install -e . && \
    cd .. && \
    rm -rf torch2trt

# Clone and install trt_pose manually
RUN git clone https://github.com/NVIDIA-AI-IOT/trt_pose && \
    cd trt_pose && \
    python3 setup.py install && \
    cd .. && \
    rm -rf trt_pose

# Clone the securesight repository
RUN git clone https://github.com/Gerrux/securesight.git && \
    mv securesight/microservice/* . && \
    rm -rf securesight

RUN pip3 install --upgrade \
    sympy==1.13.1 \
    typing-extensions>=4.10.0 \
    pip setuptools wheel

# Expose the port for the FastAPI application
EXPOSE 9000

# Start the FastAPI application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9000"]