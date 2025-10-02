# Railway 部署用的 Dockerfile
FROM node:22-alpine

WORKDIR /app

# 复制后端文件
COPY backend/package*.json ./
RUN npm ci --only=production

# 复制后端源代码
COPY backend/ .

# 构建应用
RUN npm run build

# 暴露端口
EXPOSE 3001

# 启动应用
CMD ["npm", "start"]
