FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
ENV BRIDGE_PORT=9080
EXPOSE 9080
CMD ["python", "app.py"]
