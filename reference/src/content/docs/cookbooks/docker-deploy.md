---
title: Deploy em Produção & Docker
description: Como empacotar, compilar e executar serviços FlexLang em contêineres Docker ultra-leves.
---

# Deploy em Produção & Docker

Como o comando `flex build` gera um binário nativo Go autônomo, suas imagens Docker de produção podem usar a imagem base `scratch` ou `alpine` pesando menos de **25 MB**.

---

## 🐳 Multi-Stage Dockerfile Recomendado

Crie um arquivo `Dockerfile` na raiz do projeto:

```dockerfile
# Estágio 1: Build do Binário
FROM node:22-alpine AS builder

# Instala Go e ferramentas de compilação
RUN apk add --no-cache go

WORKDIR /app

# Instala a CLI da FlexLang
RUN npm install -g @flexlang/cli

# Copia os arquivos do projeto
COPY . .

# Compila o binário nativo
RUN flex build src/main.flex

# Estágio 2: Imagem Final de Produção Ultra-Leve
FROM alpine:latest

WORKDIR /app

# Copia apenas o executável compilado
COPY --from=builder /app/build/main /app/server

# Expõe a porta do serviço
EXPOSE 8080

CMD ["/app/server"]
```

---

## 🚀 Executando o Contêiner

```bash
docker build -t meu-servico-flex .
docker run -p 8080:8080 -e DATABASE_URL="postgres://..." meu-servico-flex
```
