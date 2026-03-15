import { aiConfig } from "@/config/aiConfig";

export const prerender = false;

interface RequestBody {
  title: string;
  content: string;
}

export async function POST({ request }: { request: Request }) {
  try {
    const body: RequestBody = await request.json();
    const { title, content } = body;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "缺少文章内容" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const cleanContent = content.replace(/<[^>]+>/g, "").slice(0, 6000);

    const systemPrompt = `你是一个专业的博客文章摘要助手。请根据以下文章内容，生成一个简洁的中文摘要。

【要求】：
1. 摘要长度控制在 100-200 字以内
2. 包含文章的核心主题和主要观点
3. 使用中文句号结尾
4. 不要添加任何格式标记或引号
5. 直接输出摘要内容，不要有任何前缀

【文章标题】：${title}
【文章内容】：${cleanContent}`;

    const response = await fetch(`${aiConfig.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aiConfig.deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "请生成这篇文章的摘要" },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `DeepSeek API 错误: ${errorText}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim() || "生成摘要失败";

    return new Response(JSON.stringify({ summary }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("AI 摘要生成失败:", error);
    return new Response(
      JSON.stringify({ error: `服务器错误: ${error instanceof Error ? error.message : "未知错误"}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
