# Python image (Stable version)
FROM python:3.10-slim

# System level library install (image processing er jonno dorkar hoy)
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Working directory
WORKDIR /app

# Library install
# Note: requirements.txt a jodi kono kothin version thake seta ekhane bypass hobe
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Puro project copy
COPY . .

# Hugging Face er default port 7860
EXPOSE 7860

# Waitress install kora (production server er jonno)
RUN pip install waitress

# App run kora
CMD ["python", "app.py"]