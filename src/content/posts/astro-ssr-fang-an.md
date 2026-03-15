---
title: Astro SSR 方案技术报告
published: 2026-03-09
pinned: false
description: Firefly 博客系统 SSR 方案详细技术报告，解决上线后文章更新需要重新构建的问题
tags: [Astro, SSR, Firefly, 技术报告]
category: 技术
draft: false
---

# Astro SSR 方案技术报告

## 一、背景与目标

### 1.1 项目背景

当前 Firefly 主题博客系统采用 SSG（静态站点生成）模式，文章内容在构建时生成静态 HTML 文件。Django 作为后端博客管理系统，通过以下方式与 Firefly 集成：

- Django Admin 管理文章
- 同步脚本将 Django 文章生成 Markdown 文件到 Firefly
- Firefly 构建时读取本地 Markdown 文件生成静态页面

### 1.2 存在的问题

开发模式下使用 `pnpm dev`（热加载），文章更新可以实时同步。但上线后存在以下问题：

1. **更新延迟**：修改文章后需要重新 build 才能生效
2. **部署复杂**：需要手动 trigger 或配置 Webhook 自动部署
3. **用户体验**：无法实现真正的"即改即见"

### 1.3 目标

实现 Firefly 的 SSR（服务器端渲染）模式，使得：
- 文章更新无需重新 build
- 用户访问时实时获取最新内容
- 保留静态博客的高性能优势（可选 hybrid 模式）

---

## 二、现有架构分析

### 2.1 当前技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 前端 | Astro + Firefly 主题 | 静态站点生成器 |
| 后端 | Django | 博客管理 |
| 数据库 | MySQL | 存储文章数据 |
| 评论系统 | Artalk | Docker 部署在 8888 端口 |

### 2.2 当前数据流

```
Django Admin 保存文章
    ↓
同步脚本生成 django-{id}.md
    ↓
Astro 构建时读取 Markdown
    ↓
生成静态 HTML
    ↓
用户访问静态页面
```

### 2.3 当前 URL 路由

| 来源 | 文件 | URL |
|------|------|-----|
| Firefly 本地 | firefly.md | /posts/firefly/ |
| Django 文章 | django-45.md | /posts/45/ |

---

## 三、SSR 方案详解

### 3.1 SSG vs SSR vs Hybrid

#### SSG（静态站点生成）- 当前模式

```
构建时：Markdown → HTML
访问时：直接返回 HTML（无需处理）
```

- **优点**：性能最快，部署简单
- **缺点**：更新需要重新 build

#### SSR（服务器端渲染）

```
访问时：请求 → API 获取数据 → 实时渲染 HTML → 返回
```

- **优点**：内容实时更新，无需 rebuild
- **缺点**：每次访问都需要服务器处理，性能较低

#### Hybrid（混合模式）

```
静态页面：不变的内容（如关于页、友链）
动态页面：需要实时更新的内容（如文章列表）
```

- **优点**：兼顾性能与动态性
- **缺点**：配置相对复杂

### 3.2 推荐方案：Hybrid 模式

**推荐使用 `output: 'hybrid'` 模式**，理由：

1. **保留静态性能**：大部分页面（如首页、关于页、友链）保持静态
2. **动态文章内容**：文章页面实时从 API 获取
3. **平滑过渡**：可以逐步迁移，无需完全重构

---

## 四、实现步骤

### 4.1 环境准备

```bash
# 进入 Firefly 目录
cd /home/bahua/blog/Firefly

# 安装 SSR 适配器
pnpm add @astrojs/node
```

### 4.2 配置 Astro

修改 `astro.config.mjs`：

```javascript
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'hybrid',
  adapter: node({
    mode: 'standalone'
  }),
  // 保留原有的其他配置...
});
```

### 4.3 修改文章页面逻辑

文件：`src/pages/posts/[...slug].astro`

#### 需要修改的部分

1. **移除 `getStaticPaths`**
   - SSR 模式下不再需要在构建时生成所有路径
   - 改为动态路由处理

2. **动态获取文章数据**
   ```typescript
   // 根据 slug 判断来源
   const slug = Astro.params.slug;
   
   // 本地文件检查
   if (localFileExists(slug)) {
     // 读取本地 Markdown
   }
   // Django API 检查
   else {
     // 从 API 获取
   }
   ```

3. **数据获取逻辑**
   ```typescript
   // 获取文章数据
   const article = await fetchDjangoArticle(slug);
   
   // 处理 Markdown
   const { html, headings } = await processMarkdown(article.body);
   ```

### 4.4 运行 SSR 模式

```bash
# 开发模式（推荐）
pnpm dev

# 或构建后运行
pnpm build
node dist/server/entry.mjs
```

### 4.5 验证功能

| 测试场景 | 预期结果 |
|----------|----------|
| 访问 `/posts/45/` | 实时从 Django API 获取并渲染 |
| Django 新增文章 | 无需 rebuild，刷新页面即见 |
| 访问 `/about/` | 静态页面（保持原有性能） |

---

## 五、部署方案

### 5.1 本地部署

开发模式下直接运行：

```bash
cd /home/bahua/blog/Firefly
pnpm dev
```

服务运行在 `http://localhost:4321`

### 5.2 服务器部署

#### 方案一：Node.js 服务器

```bash
# 构建
pnpm build

# 运行 SSR 服务器
node dist/server/entry.mjs
```

可以使用 PM2 管理进程：

```bash
pm2 start dist/server/entry.mjs --name firefly
```

#### 方案二：Vercel/Netlify（需适配）

这些平台原生支持 SSR，但需要调整配置。

### 5.3 域名配置

```
Django 博客：http://localhost:8000/
Firefly SSR：http://localhost:4321/
```

生产环境需要配置反向代理或使用 nginx 转发。

---

## 六、优缺点对比

### 6.1 三种模式对比

| 特性 | SSG（当前） | SSR | Hybrid |
|------|-------------|-----|--------|
| 内容实时性 | 需要 rebuild | 实时 | 实时（动态部分） |
| 性能 | 最快 | 较慢 | 中等 |
| 部署复杂度 | 简单 | 中等 | 中等 |
| 服务器要求 | 低（静态托管） | 高（Node.js） | 中等 |
| 开发模式 | pnpm dev | pnpm dev | pnpm dev |

### 6.2 选型建议

| 场景 | 推荐方案 |
|------|----------|
| 文章更新频率低 | SSG + Webhook 部署 |
| 文章更新频率高 | SSR 或 Hybrid |
| 追求最佳性能 | SSG |
| 追求最佳体验 | Hybrid |

---

## 七、总结

### 7.1 实施方案

1. **安装依赖**：`pnpm add @astrojs/node`
2. **修改配置**：`astro.config.mjs` 设置为 `hybrid` 模式
3. **调整代码**：修改 `[...slug].astro` 动态获取文章
4. **测试验证**：确保本地运行正常
5. **部署上线**：选择合适的部署方式

### 7.2 预期效果

- ✅ Django Admin 修改文章后，Firefly 立即可见
- ✅ 无需手动 rebuild 或 Webhook 触发
- ✅ 保留静态页面性能优势（Hybrid 模式）
- ✅ 开发体验与上线后一致

### 7.3 风险与注意事项

1. **服务器资源**：SSR 模式需要持续运行服务器
2. **API 依赖**：需要确保 Django API 稳定
3. **缓存策略**：需要合理设置缓存避免频繁请求

---

## 八、附录：常用命令

```bash
# 安装 SSR 适配器
pnpm add @astrojs/node

# 开发模式
pnpm dev

# 构建
pnpm build

# 运行 SSR 服务器
node dist/server/entry.mjs

# 使用 PM2 管理
pm2 start dist/server/entry.mjs --name firefly
pm2 restart firefly
pm2 logs firefly
```

---

*报告生成时间：2026-03-09*  
*作者：bahua*  
*分类：技术*