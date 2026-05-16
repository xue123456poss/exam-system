/**
 * 华夏良子考试系统 - Cloudflare Workers 后端
 * 
 * 部署步骤：
 * 1. 注册 Cloudflare 账号 (https://dash.cloudflare.com)
 * 2. 创建一个 KV 命名空间（名称：exam-data）
 * 3. 创建一个 Worker
 * 4. 将此代码粘贴到 Worker 编辑器中
 * 5. 绑定 KV 命名空间到 Worker
 * 6. 配置 API Token（可选，用于安全验证）
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // 允许来自任何来源的请求（生产环境建议限制）
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    };

    try {
      // API Key 验证（如果配置了的话）
      const apiKey = request.headers.get('X-API-Key');
      const configuredKey = env.API_KEY;
      
      if (configuredKey && apiKey !== configuredKey) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 路由处理
      const path = url.pathname;

      // GET /api/keys - 列出所有数据键名
      if (path === '/api/keys' && request.method === 'GET') {
        const list = await env.EXAM_KV.list();
        return new Response(JSON.stringify({ keys: list.keys.map(k => k.name) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // GET /api/data/{key} - 获取指定键的数据
      const dataMatch = path.match(/^\/api\/data\/(.+)$/);
      if (dataMatch && request.method === 'GET') {
        const key = dataMatch[1];
        const value = await env.EXAM_KV.get(key);
        if (value === null) {
          return new Response(JSON.stringify({ error: 'Key not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(value, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // PUT /api/data/{key} - 存储数据
      if (dataMatch && (request.method === 'PUT' || request.method === 'POST')) {
        const key = dataMatch[1];
        const body = await request.text();
        
        // 验证 JSON 格式
        try {
          JSON.parse(body);
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        await env.EXAM_KV.put(key, body);
        return new Response(JSON.stringify({ success: true, key }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // DELETE /api/data/{key} - 删除数据
      if (dataMatch && request.method === 'DELETE') {
        const key = dataMatch[1];
        await env.EXAM_KV.delete(key);
        return new Response(JSON.stringify({ success: true, deleted: key }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 健康检查
      if (path === '/health' || path === '/') {
        return new Response(JSON.stringify({ status: 'ok', service: 'exam-system-backend' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 未知路由
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

/*
================================================================================
部署指南（图文版）
================================================================================

第一步：创建 Cloudflare 账号
- 访问 https://dash.cloudflare.com
- 使用邮箱注册账号

第二步：创建 KV 命名空间
1. 登录后，点击左侧菜单 "Workers & Pages"
2. 点击 "Overview"
3. 点击 "Create a Worker"
4. 或者直接访问 https://dash.cloudflare.com/{你的账户}/workers-and-pages
5. 在 "Storage" 标签页，点击 "Create a namespace"
6. 命名空间名称输入：exam-data
7. 点击 "Create"

第三步：创建 Worker
1. 在 Workers & Pages 页面，点击 "Create Worker"
2. Worker 名称输入：exam-api（或其他名称）
3. 点击 "Deploy"
4. 点击 "Edit code"，将上面的代码粘贴进去
5. 点击 "Save and deploy"

第四步：绑定 KV 命名空间
1. 在 Worker 页面，点击 "Settings"
2. 点击 "Variables"
3. 找到 "KV Namespace Bindings"，点击 "Edit variable"
4. Variable name 输入：EXAM_KV
5. KV namespace 选择：exam-data（刚才创建的）
6. 保存

第五步（可选）：设置 API Key
1. 在 Worker Settings > Variables 页面
2. 找到 "Secret variables"，点击 "Edit variable"
3. Variable name 输入：API_KEY
4. Variable value 输入：你的密码（建议使用随机字符串）
5. 保存并重新部署

第六步：获取 Worker URL
- Worker URL 格式：https://exam-api.{你的subdomain}.workers.dev
- 如果你设置了 API Key，在 URL 参数中需要带上 X-API-Key 头

================================================================================
Cloudflare 免费额度
================================================================================
- Workers: 每天 100,000 请求
- KV 读取: 每天 100,000 次
- KV 写入: 每天 1,000 次（考试系统足够用）
- KV 删除: 无限制

KV 存储: 1GB

================================================================================
*/
