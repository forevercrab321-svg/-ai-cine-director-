import { NextResponse } from 'next/server';
import { getSetting } from '../../../lib/db';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-replicate-token',
  'Content-Type': 'application/json',
};

/**
 * 辅助函数：统一构造 JSON 响应
 */
function createJsonResponse(data: any, status: number = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: corsHeaders,
  });
}

/**
 * OPTIONS 处理跨域预检
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * POST /api/replicate - 创建预测任务
 */
export async function POST(req: Request) {
  try {
    // 1. 获取 Token (优先级：环境变量 > 数据库)
    const apiKey = process.env.REPLICATE_API_TOKEN || getSetting('replicate_api_token');
    
    if (!apiKey) {
      return createJsonResponse({ error: "Replicate token not configured" }, 401);
    }

    // 2. 解析 Body
    const body = await req.json().catch(() => null);
    if (!body) {
      return createJsonResponse({ error: "Invalid JSON body" }, 400);
    }

    // 3. 转发请求到 Replicate
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return createJsonResponse({ 
        error: data?.detail || "Replicate API error during POST",
        details: data 
      }, response.status);
    }

    return createJsonResponse(data, 201);
  } catch (error: any) {
    return createJsonResponse({ error: error.message || "Internal Server Error in POST" }, 500);
  }
}

/**
 * GET /api/replicate?id=<prediction_id> - 查询预测状态
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const apiKey = process.env.REPLICATE_API_TOKEN || getSetting('replicate_api_token');

    if (!id) {
      return createJsonResponse({ error: "Missing id parameter" }, 400);
    }

    if (!apiKey) {
      return createJsonResponse({ error: "Replicate token not configured" }, 401);
    }

    const response = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: {
        "Authorization": `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return createJsonResponse({ 
        error: data?.detail || "Replicate API error during GET",
        details: data 
      }, response.status);
    }

    return createJsonResponse(data, 200);
  } catch (error: any) {
    return createJsonResponse({ error: error.message || "Internal Server Error in GET" }, 500);
  }
}

/**
 * 处理不支持的请求方法，防止返回默认 405 HTML
 */
const methodNotAllowed = () => createJsonResponse({ error: "Method Not Allowed" }, 405);
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
