---
title: Production Deploy & Docker
description: Packaging, compiling, and deploying FlexLang microservices in minimal Docker containers.
---

Because `flex build` compiles into a standalone native binary, production Docker images can leverage `scratch` or `alpine` bases weighting under **25 MB**.

---

## 🐳 Recommended Multi-Stage Dockerfile

Create a `Dockerfile` at your project root:

```dockerfile
# Stage 1: Build & Compilation
FROM node:22-alpine AS builder

# Install Go compiler
RUN apk add --no-cache go

WORKDIR /app

# Install FlexLang CLI
RUN npm install -g @flexlang/cli

# Copy source files
COPY . .

# Compile native binary
RUN flex build src/main.flex

# Stage 2: Minimal Production Image
FROM alpine:latest

WORKDIR /app

# Copy only the compiled binary
COPY --from=builder /app/build/main /app/server

EXPOSE 8080

CMD ["/app/server"]
```

---

## 🚀 Running the Container

```bash
docker build -t my-flex-service .
docker run -p 8080:8080 -e DATABASE_URL="postgres://..." my-flex-service
```
