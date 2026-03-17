// Django API 客户端
const API_BASE_URL = import.meta.env.PUBLIC_API_URL ? `${import.meta.env.PUBLIC_API_URL}/api` : 'http://localhost:8000/api';

export interface DjangoArticle {
    id: number;
    title: string;
    body: string;
    pub_time: string;
    views: number;
    likes: number;
    dislikes: number;
    shares: number;
    author: string;
    category: {
        id: number;
        name: string;
        slug: string;
        get_absolute_url: string;
    };
    tags: Array<{
        id: number;
        name: string;
        slug: string;
        get_absolute_url: string;
    }>;
    url: string;
    get_first_image_url: string;
}

export interface DjangoCategory {
    id: number;
    name: string;
    slug: string;
    get_absolute_url: string;
}

export interface DjangoTag {
    id: number;
    name: string;
    slug: string;
    get_absolute_url: string;
}

export interface DjangoApiResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

class DjangoApiClient {
    private baseUrl: string;

    constructor(baseUrl: string = API_BASE_URL) {
        this.baseUrl = baseUrl;
    }

    async fetchArticles(page: number = 1, pageSize: number = 10): Promise<DjangoApiResponse<DjangoArticle>> {
        const response = await fetch(`${this.baseUrl}/articles/?page=${page}&page_size=${pageSize}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch articles: ${response.statusText}`);
        }
        return await response.json();
    }

    async fetchArticleById(id: number): Promise<DjangoArticle> {
        const response = await fetch(`${this.baseUrl}/articles/${id}/`);
        if (!response.ok) {
            throw new Error(`Failed to fetch article ${id}: ${response.statusText}`);
        }
        return await response.json();
    }

    async fetchCategories(): Promise<DjangoCategory[]> {
        const response = await fetch(`${this.baseUrl}/categories/`);
        if (!response.ok) {
            throw new Error(`Failed to fetch categories: ${response.statusText}`);
        }
        return await response.json();
    }

    async fetchTags(): Promise<DjangoTag[]> {
        const response = await fetch(`${this.baseUrl}/tags/`);
        if (!response.ok) {
            throw new Error(`Failed to fetch tags: ${response.statusText}`);
        }
        return await response.json();
    }

    async searchArticles(query: string, page: number = 1): Promise<DjangoApiResponse<DjangoArticle>> {
        const response = await fetch(`${this.baseUrl}/articles/?search=${encodeURIComponent(query)}&page=${page}`);
        if (!response.ok) {
            throw new Error(`Failed to search articles: ${response.statusText}`);
        }
        return await response.json();
    }

    async getArticlesByCategory(categorySlug: string, page: number = 1, pageSize: number = 1): Promise<DjangoApiResponse<DjangoArticle>> {
        const response = await fetch(`${this.baseUrl}/articles/?category_slug=${categorySlug}&page=${page}&page_size=${pageSize}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch articles by category: ${response.statusText}`);
        }
        return await response.json();
    }

    async getArticlesByTag(tagSlug: string, page: number = 1, pageSize: number = 1): Promise<DjangoApiResponse<DjangoArticle>> {
        const response = await fetch(`${this.baseUrl}/articles/?tag_slug=${tagSlug}&page=${page}&page_size=${pageSize}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch articles by tag: ${response.statusText}`);
        }
        return await response.json();
    }

    async fetchHotArticles(pageSize: number = 5): Promise<DjangoArticle[]> {
        const response = await fetch(`${this.baseUrl}/articles/?ordering=-views&page_size=${pageSize}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch hot articles: ${response.statusText}`);
        }
        const data = await response.json();
        return data.results || [];
    }

    async fetchRecentArticles(pageSize: number = 5): Promise<DjangoArticle[]> {
        const response = await fetch(`${this.baseUrl}/articles/?ordering=-pub_time&page_size=${pageSize}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch recent articles: ${response.statusText}`);
        }
        const data = await response.json();
        return data.results || [];
    }

    async fetchAllArticles(): Promise<DjangoArticle[]> {
        const allArticles: DjangoArticle[] = [];
        let page = 1;
        while (true) {
            const response = await fetch(`${this.baseUrl}/articles/?page=${page}&page_size=50`);
            if (!response.ok) {
                throw new Error(`Failed to fetch all articles: ${response.statusText}`);
            }
            const data = await response.json();
            allArticles.push(...data.results || []);
            if (!data.next) break;
            page++;
        }
        return allArticles;
    }

    async fetchTopArticles(limit: number = 10): Promise<DjangoArticle[]> {
        const response = await fetch(`${this.baseUrl}/articles/?ordering=-views&page_size=${limit}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch top articles: ${response.statusText}`);
        }
        const data = await response.json();
        return data.results || [];
    }

    async fetchCategoryStats(): Promise<{ name: string; value: number }[]> {
        const categories = await this.fetchCategories();
        const articles = await this.fetchAllArticles();
        
        const categoryCount: { [key: string]: number } = {};
        articles.forEach(article => {
            const catName = article.category?.name;
            if (catName) {
                categoryCount[catName] = (categoryCount[catName] || 0) + 1;
            }
        });
        
        return categories.map(cat => ({
            name: cat.name,
            value: categoryCount[cat.name] || 0
        }));
    }
}

// 创建单例实例
export const djangoApi = new DjangoApiClient();

// 辅助函数：Django已返回完整URL，无需转换
function convertBodyImageUrls(body: string): string {
    return body;
}

// 工具函数：将Django文章转换为Firefly格式
export function convertToFireflyPost(article: DjangoArticle): any {
    // 在转换前先替换 body 中的图片 URL
    const convertedBody = convertBodyImageUrls(article.body);
    
    return {
        id: article.id.toString(),
        slug: article.id.toString(),
        body: convertedBody,
        data: {
            title: article.title,
            published: new Date(article.pub_time),
            updated: new Date(article.pub_time),
            draft: false,
            description: getExcerpt(article.body, 150),
            image: article.get_first_image_url || '',
            tags: article.tags.map(tag => tag.name),
            category: article.category?.name || '',
            lang: 'zh',
            pinned: false,
            author: article.author,
            comment: true,
        },
        _raw: article,
    };
}

// 工具函数：获取文章摘要
export function getExcerpt(content: string, length: number = 150): string {
    const plainText = content
        .replace(/#{1,6}\s*/g, '')
        .replace(/\*\*/g, '')
        .replace(/`/g, '')
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[.*?\]\(.*?\)/g, '')
        .replace(/<[^>]*>/g, '')
        .replace(/\n/g, ' ')
        .trim();
    
    return plainText.length > length ? plainText.substring(0, length) + '...' : plainText;
}