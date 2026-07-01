// Cloudflare Workers - SearXNG 搜索代理
// 部署到 Cloudflare Workers 后，把 Workers 地址给 SearXNG 容器配 env
// SearXNG 所有搜索请求通过这个 Workers 转发到搜索引擎

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // 只允许 SearXNG 容器 IP 访问（可选白名单）
    // const allowedIP = '你的FNOS公网IP';
    // if (request.headers.get('CF-Connecting-IP') !== allowedIP) {
    //   return new Response('Forbidden', { status: 403 });
    // }

    // 从请求路径和参数中提取目标搜索引擎和查询
    // 例如: /search?q=AI&engine=google → 转发到 Google
    const targetEngine = url.searchParams.get('engine') || 'google';
    const query = url.searchParams.get('q');
    
    if (!query) {
      return new Response(JSON.stringify({ error: 'query required' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 搜索引擎映射表
    const searchEngines = {
      google: {
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en`,
        type: 'html',
      },
      bing: {
        url: `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=10`,
        type: 'html',
      },
      duckduckgo: {
        url: `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
        type: 'html',
      },
      wikipedia: {
        url: `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=10`,
        type: 'json',
      },
      'google-scholar': {
        url: `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}&hl=en`,
        type: 'html',
      },
      arxiv: {
        url: `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=10`,
        type: 'xml',
      },
      semantic: {
        url: `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=10&fields=title,url,year,authors`,
        type: 'json',
      },
      openalex: {
        url: `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=10&sort=relevance_score:desc`,
        type: 'json',
      },
    };

    const engine = searchEngines[targetEngine];
    if (!engine) {
      return new Response(JSON.stringify({ error: `unsupported engine: ${targetEngine}` }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const response = await fetch(engine.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SearXNG/1.0; +https://github.com/searxng/searxng)',
          'Accept': engine.type === 'json' ? 'application/json' : 'text/html',
        },
      });

      const contentType = response.headers.get('Content-Type') || 'text/html';
      
      return new Response(response.body, {
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
