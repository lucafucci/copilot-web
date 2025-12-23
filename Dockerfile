FROM node:22-slim

# Install curl and tar
RUN apt-get update && apt-get install -y curl tar && rm -rf /var/lib/apt/lists/*

# Install copilot CLI manually
RUN mkdir -p /usr/local/bin && \
    curl -fsSL https://github.com/github/copilot-cli/releases/latest/download/copilot-linux-x64.tar.gz -o /tmp/copilot.tar.gz && \
    tar -xzf /tmp/copilot.tar.gz -C /usr/local/bin && \
    chmod +x /usr/local/bin/copilot && \
    rm /tmp/copilot.tar.gz

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY src/ ./src/
COPY public/ ./public/

# Create directory for copilot config
RUN mkdir -p /root/.config

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "src/server.js"]
