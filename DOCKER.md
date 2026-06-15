# Docker 部署指南

本项目使用 Docker 容器来运行 MySQL 数据库和 phpMyAdmin 管理界面。

## 前置要求

- 安装 Docker Desktop（Windows/Mac）或 Docker Engine（Linux）
- 安装 Docker Compose

## 快速开始

### 1. 启动服务

```bash
docker-compose up -d
```

这个命令会：
- 下载 MySQL 8.0 镜像（如果还没有）
- 下载 phpMyAdmin 镜像（如果还没有）
- 创建并启动 MySQL 容器
- 创建并启动 phpMyAdmin 容器
- 创建数据卷用于持久化数据

### 2. 查看服务状态

```bash
docker-compose ps
```

### 3. 查看日志

```bash
# 查看所有服务日志
docker-compose logs -f

# 只查看 MySQL 日志
docker-compose logs -f mysql

# 只查看 phpMyAdmin 日志
docker-compose logs -f phpmyadmin
```

### 4. 停止服务

```bash
docker-compose stop
```

### 5. 停止并删除容器

```bash
docker-compose down
```

注意：这个命令会删除容器，但不会删除数据卷，数据仍然保留。

### 6. 停止并删除容器和数据卷

```bash
docker-compose down -v
```

警告：这个命令会删除所有数据，包括数据库中的数据！

## 访问地址

### 数据库连接信息

- **主机**: localhost
- **端口**: 3306
- **用户名**: quotation_user
- **密码**: quotation123
- **数据库名**: quotation_system

Root 用户：
- **用户名**: root
- **密码**: root123456

### phpMyAdmin 管理界面

访问地址：http://localhost:8080

登录信息：
- **服务器**: mysql
- **用户名**: quotation_user
- **密码**: quotation123

## 项目配置

### 修改 .env 文件

如果需要修改数据库配置，请编辑 `.env` 文件：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=your_database_name
```

修改后需要重启服务：

```bash
docker-compose restart
```

## 初始化数据库

1. 启动 Docker 服务：
```bash
docker-compose up -d
```

2. 等待 MySQL 完全启动（约 10-30 秒）

3. 访问项目的数据库管理页面：http://localhost:5000/database

4. 点击"初始化数据库"按钮

## 数据备份

### 备份数据库

```bash
docker-compose exec mysql mysqldump -u quotation_user -p quotation_system > backup.sql
```

输入密码：quotation123

### 恢复数据库

```bash
docker-compose exec -T mysql mysql -u quotation_user -p quotation_system < backup.sql
```

输入密码：quotation123

## 常见问题

### MySQL 容器启动失败

检查端口 3306 是否被占用：
```bash
# Windows
netstat -ano | findstr :3306

# Linux/Mac
lsof -i :3306
```

如果端口被占用，可以修改 `docker-compose.yml` 中的端口映射。

### 无法连接到数据库

1. 确认 MySQL 容器正在运行：
```bash
docker-compose ps
```

2. 查看 MySQL 日志：
```bash
docker-compose logs mysql
```

3. 确认 .env 文件中的配置正确

### phpMyAdmin 无法访问

1. 确认 phpMyAdmin 容器正在运行
2. 访问 http://localhost:8080
3. 确认端口 8080 没有被占用

## 生产环境部署

对于生产环境，建议：

1. 修改默认密码
2. 使用更安全的密码
3. 配置定期备份
4. 限制网络访问
5. 使用 HTTPS

## 技术支持

如有问题，请查看：
- Docker 文档：https://docs.docker.com/
- MySQL 文档：https://dev.mysql.com/doc/
- phpMyAdmin 文档：https://docs.phpmyadmin.net/
