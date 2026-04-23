# Build stage
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Instala dependências básicas
RUN apk add --no-cache gcc musl-dev

# Cache de dependências
COPY go.mod go.sum ./
RUN go mod download

# Copia o código e compila
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o main ./cmd/api

# Final stage
FROM alpine:3.18

WORKDIR /app

# Instala certificados e timezone
RUN apk add --no-cache ca-certificates tzdata

# Copia apenas o binário necessário
COPY --from=builder /app/main .

# O backend não deve conter arquivos .env; as variáveis serão injetadas pelo Docker
EXPOSE 8080

CMD ["./main"]
