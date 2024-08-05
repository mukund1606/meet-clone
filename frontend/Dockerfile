# Use the official Node.js image
FROM node:22-bullseye

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

ARG NEXTAUTH_SECRET
ARG NEXTAUTH_URL
ARG LOGIN_USERNAME
ARG LOGIN_PASSWORD

ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV LOGIN_USERNAME=$LOGIN_USERNAME
ENV LOGIN_PASSWORD=$LOGIN_PASSWORD

# Build the application
RUN pnpm run build


# Expose the application port
EXPOSE 8080

# Command to run the application
CMD ["pnpm", "run", "start"]
