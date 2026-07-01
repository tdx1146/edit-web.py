# Cloudflare Workers 搜索代理 — 部署说明

## 部署步骤

1. 登录 Cloudflare Dashboard → Workers & Pages

2. 点击「创建 Worker」

3. 把 `searxng-proxy.js` 的代码粘贴进去

4. 点击「部署」

5. 部署成功后你会得到一个 URL，类似：
   `https://searxng-proxy.你的用户名.workers.dev`

6. 把这个 URL 告诉我，我配置到 SearXNG 容器的环境变量里

## 验证

浏览器访问：
```
https://searxng-proxy.你的用户名.workers.dev/search?q=hello+world&engine=google
```

应该返回 Google 的搜索结果 HTML（或者 json 格式）。

## 安全

- 默认任何人都可以调用这个 Workers（因为是公开的）
- 如果想限制只允许你的 FNOS 服务器访问，去掉代码里的 IP 白名单注释
