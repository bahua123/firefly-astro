#!/bin/bash

echo "🔄 重启 Firefly 服务..."

# 杀掉占用 4321 端口的进程
lsof -ti:4321 | xargs kill -9 2>/dev/null

# 等待端口释放
sleep 2

# 进入项目目录并启动
cd /home/bahua/blog/Firefly
echo "🚀 启动服务..."
pnpm preview --host
