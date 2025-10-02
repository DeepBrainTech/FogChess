#!/bin/bash

# 数据库初始化脚本
echo "正在初始化 PostgreSQL 数据库..."

# 等待 PostgreSQL 启动
echo "等待 PostgreSQL 启动..."
sleep 10

# 运行初始化脚本
docker exec fogchess-postgres-1 psql -U fogchess -d fogchess -f /docker-entrypoint-initdb.d/init.sql

echo "数据库初始化完成！"
echo "现在可以运行 docker compose up 启动应用"
