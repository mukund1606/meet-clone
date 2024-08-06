# Use the official Node.js image
FROM node:20-bullseye-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
  python3 \
  python3-pip \
  build-essential \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy package.json and pnpm-lock.yaml if present
COPY package.json .
COPY pnpm-lock.yaml .

# Install pnpm globally and project dependencies
RUN npm install -g pnpm
RUN pnpm install

# Copy the rest of the application code
COPY . .

ARG ANNOUNCED_IP

ENV ANNOUNCED_IP=$ANNOUNCED_IP

# Build the application
RUN pnpm run build

# Expose the application port
EXPOSE 5000

# Command to run the application
CMD ["pnpm", "run", "start"]
