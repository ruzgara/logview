FROM python:3.13-alpine

WORKDIR /app

COPY requirements.txt .

RUN apk add --no-cache gcc musl-dev linux-headers
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir debugpy

EXPOSE 5678

COPY src/ ./src/

CMD ["python", "src/main.py"]