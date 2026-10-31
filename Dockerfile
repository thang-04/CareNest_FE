# Build stage: biến VITE_* được nhúng vào bundle lúc build, đổi giá trị phải build lại image
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# plugin-react 4.x khai báo peer vite ≤7 nhưng lockfile dùng vite 8; npm 10 chặn (ERESOLVE) ⇒ bỏ qua peer như npm local
RUN npm ci --legacy-peer-deps
COPY . .
ARG VITE_API_BASE_URL=/api
# BE chưa deploy ⇒ mặc định mock; BE lên thì build với VITE_USE_MOCK=false
ARG VITE_USE_MOCK=true
# Auth tách khỏi dữ liệu: gateway = đăng nhập qua /api/auth của BE (BE đã bật gateway), còn lại mock
ARG VITE_AUTH_MODE=mock
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL VITE_USE_MOCK=$VITE_USE_MOCK VITE_AUTH_MODE=$VITE_AUTH_MODE
RUN npm run build

# Runtime stage: chỉ phục vụ file tĩnh; /api do nginx trên host proxy sang BE
FROM nginx:1.27-alpine
COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
# Mặc định nghe 80 (chạy local với -p); VPS đặt 127.0.0.1:18300 trong compose.yaml
ENV NGINX_LISTEN=80
EXPOSE 80
