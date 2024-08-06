# Use the official Node.js image as the base for the build stage
FROM node:20-bullseye-slim AS builder

# Install build dependencies
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

# Build the application
RUN pnpm run build

# Use a minimal Node.js image for the final stage
FROM node:20-bullseye-slim

# Set the working directory
WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y \
  python3 \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Copy only the built application and required files from the builder stage
COPY --from=builder /app/package.json .
COPY --from=builder /app/pnpm-lock.yaml .
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

ARG ANNOUNCED_IP

ENV ANNOUNCED_IP=$ANNOUNCED_IP

# Expose the application port
EXPOSE 5000

# Command to run the application
CMD ["npm", "run", "start"]
