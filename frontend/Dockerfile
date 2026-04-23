# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Final stage (Nginx)
FROM nginx:stable-alpine

# Copia build estático
COPY --from=builder /app/dist /usr/share/nginx/html

# Copia configuração do Nginx para proxy reverso
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
