import { type CollectionEntry, getCollection } from "astro:content";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { getCategoryUrl } from "@utils/url-utils";
import { djangoApi, convertToFireflyPost } from "@utils/djangoApi";

// 模块级变量：存储 Django 文章的分类统计
let djangoCategoryStats: { [key: string]: number } = {};

// 重置分类统计（用于构建时重新统计）
export function resetDjangoStats() {
	djangoCategoryStats = {};
}


// // Retrieve posts and sort them by publication date
async function getRawSortedPosts() {
	const allBlogPosts = await getCollection("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});

	const sorted = allBlogPosts.sort((a, b) => {
		// 首先按置顶状态排序，置顶文章在前
		if (a.data.pinned && !b.data.pinned) return -1;
		if (!a.data.pinned && b.data.pinned) return 1;

		// 如果置顶状态相同，则按发布日期排序
		const dateA = new Date(a.data.published);
		const dateB = new Date(b.data.published);
		return dateA > dateB ? -1 : 1;
	});
	return sorted;
}

export async function getSortedPosts() {
	const sorted = await getRawSortedPosts();

	for (let i = 1; i < sorted.length; i++) {
		sorted[i].data.nextSlug = sorted[i - 1].id;
		sorted[i].data.nextTitle = sorted[i - 1].data.title;
	}
	for (let i = 0; i < sorted.length - 1; i++) {
		sorted[i].data.prevSlug = sorted[i + 1].id;
		sorted[i].data.prevTitle = sorted[i + 1].data.title;
	}

	return sorted;
}
export type PostForList = {
	id: string;
	data: CollectionEntry<"posts">["data"];
};
export async function getSortedPostsList(): Promise<PostForList[]> {
	const sortedFullPosts = await getRawSortedPosts();

	// delete post.body
	const sortedPostsList = sortedFullPosts.map((post) => ({
		id: post.id,
		data: post.data,
	}));

	return sortedPostsList;
}
export type Tag = {
	name: string;
	count: number;
};

export async function getTagList(): Promise<Tag[]> {
	const allBlogPosts = await getCollection<"posts">("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});

	const countMap: { [key: string]: number } = {};
	
	// 统计本地 Firefly 文章标签数量
	allBlogPosts.forEach((post: { data: { tags: string[] } }) => {
		post.data.tags.forEach((tag: string) => {
			if (!countMap[tag]) countMap[tag] = 0;
			countMap[tag]++;
		});
	});

	// 尝试获取 Django 标签列表（简化：不获取每个标签的文章数量）
	try {
		const djangoTags = await djangoApi.fetchTags();
		for (const tag of djangoTags) {
			// 直接使用 Django 标签名称，文章数量在归档页面筛选时动态计算
			if (!countMap[tag.name]) {
				countMap[tag.name] = 0;
			}
		}
	} catch (error) {
		console.warn("获取 Django 标签失败:", error);
	}

	// sort tags
	const keys: string[] = Object.keys(countMap).sort((a, b) => {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	return keys.map((key) => ({ name: key, count: countMap[key] }));
}

export type Category = {
	name: string;
	count: number;
	url: string;
};

export async function getCategoryList(): Promise<Category[]> {
	// 获取本地 Firefly 分类
	const allBlogPosts = await getCollection<"posts">("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});
	const count: { [key: string]: number } = {};
	
	// 统计本地 Firefly 分类文章数量
	allBlogPosts.forEach((post: { data: { category: string | null } }) => {
		if (!post.data.category) {
			const ucKey = i18n(I18nKey.uncategorized);
			count[ucKey] = count[ucKey] ? count[ucKey] + 1 : 1;
			return;
		}

		const categoryName =
			typeof post.data.category === "string"
				? post.data.category.trim()
				: String(post.data.category).trim();

		count[categoryName] = count[categoryName] ? count[categoryName] + 1 : 1;
	});

	// 尝试获取 Django 分类列表并统计文章数量
	try {
		const djangoCategories = await djangoApi.fetchCategories();
		
		// 统计Django文章分类数量（独立统计，不依赖全局变量）
		let djangoStats: { [key: string]: number } = {};
		
		// 检查是否已经有Django分类统计（getCombinedPosts可能已经填充）
		// 注意：由于Astro构建是并行的，这里可能看到不同的状态
		if (Object.keys(djangoCategoryStats).length > 0) {
			// 使用已缓存的统计
			djangoStats = { ...djangoCategoryStats };
		} else {
			// 自己获取并统计Django文章
			let allDjangoArticles = [];
			let page = 1;
			while (true) {
				const response = await djangoApi.fetchArticles(page, 50);
				allDjangoArticles.push(...response.results);
				if (!response.next) break;
				page++;
			}
			
			// 统计Django文章分类
			for (const article of allDjangoArticles) {
				const catName = article.category?.name;
				if (catName) {
					djangoStats[catName] = (djangoStats[catName] || 0) + 1;
				}
			}
			
			// 同时更新全局缓存（供其他函数使用）
			Object.keys(djangoStats).forEach(catName => {
				djangoCategoryStats[catName] = djangoStats[catName];
			});
		}
		
		// 使用统计结果更新分类数量
		for (const cat of djangoCategories) {
			const djangoCount = djangoStats[cat.name] || 0;
			
			// 如果本地没有这个分类，直接使用 Django 统计的数量
			if (!count[cat.name]) {
				count[cat.name] = djangoCount;
			} else {
				// 如果本地已有这个分类（Firefly 本地文章），加上 Django 的数量
				count[cat.name] += djangoCount;
			}
		}
	} catch (error) {
		console.warn("获取 Django 分类失败:", error);
	}

	const lst = Object.keys(count).sort((a, b) => {
		return (
			count[b] - count[a] || a.toLowerCase().localeCompare(b.toLowerCase())
		);
	});

	const ret: Category[] = [];
	for (const c of lst) {
		ret.push({
			name: c,
			count: count[c],
			url: getCategoryUrl(c),
		});
	}
	return ret;
}
/**
 * 获取混合数据源的文章列表（本地Firefly + Django API）
 * 说明：Astro在编译时调用此函数。现在会尝试获取Django文章并合并到列表中。
 * 如果Django API不可用，则仅返回本地文章。
 */

// 在文件顶部添加类型定义
export interface CombinedPost extends CollectionEntry<"posts"> {
  isDjango?: boolean;
  _raw?: any;
}

export async function getCombinedPosts() {
	try {
		// 获取本地Firefly文章
		const localPosts = await getSortedPosts();
		
		// 检查是否已经有Django分类统计
		const hasCachedStats = Object.keys(djangoCategoryStats).length > 0;
		let allDjangoArticles = [];
		
		// 总是获取Django文章（无论缓存状态）
		let page = 1;
		while (true) {
			const response = await djangoApi.fetchArticles(page, 50);
			allDjangoArticles.push(...response.results);
			if (!response.next) break;
			page++;
		}
		
		// 只有当没有缓存时才重新统计（避免重复累加）
		if (!hasCachedStats) {
			// 统计 Django 文章的分类数量
			for (const article of allDjangoArticles) {
				const catName = article.category?.name;
				if (catName) {
					djangoCategoryStats[catName] = (djangoCategoryStats[catName] || 0) + 1;
				}
			}
		}
		
		const djangoPosts = allDjangoArticles.map(article => {
			const post = convertToFireflyPost(article);
			post.isDjango = true;
			return post;
		});
		
		console.log('Django文章数量:', djangoPosts.length);
		console.log('Django文章示例:', djangoPosts[0] ? { 
			id: djangoPosts[0].id, 
			hasRaw: !!djangoPosts[0]._raw,
			isDjango: djangoPosts[0].isDjango 
		} : '无');
		console.log('Django分类统计:', djangoCategoryStats);
		
		// 从本地文章中提取数字 ID 集合（用于去重）
		const localNumericIds = new Set(
			localPosts.map(post => {
				const id = post.id;
				// 本地文件如 django-48.md，id 为 "django-48"，提取数字部分 "48"
				if (id.startsWith('django-')) {
					return id.replace('django-', '');
				}
				return null;
			}).filter(Boolean)
		);
		
		// 过滤掉与本地文章重复的 Django 文章（保留本地文章）
		const uniqueDjangoPosts = djangoPosts.filter(post => {
			const numericId = post.id;
			// 如果本地已有相同数字 ID 的文章，跳过 Django 版本
			if (localNumericIds.has(numericId)) {
				return false;
			}
			return true;
		});
		
		// 合并文章（本地优先）
		const combined = [...localPosts, ...uniqueDjangoPosts];
		
		// 按发布日期排序（最新的在前），同时保持置顶文章在前
		combined.sort((a, b) => {
			// 首先按置顶状态排序
			if (a.data.pinned && !b.data.pinned) return -1;
			if (!a.data.pinned && b.data.pinned) return 1;
			
			// 然后按发布日期排序
			const dateA = new Date(a.data.published);
			const dateB = new Date(b.data.published);
			return dateB.getTime() - dateA.getTime();
		});
		
		console.log('合并后文章总数:', combined.length);
		return combined;
	} catch (error) {
		console.warn("获取Django文章失败，仅使用本地文章:", error);
		return await getSortedPosts();
	}
}

export interface HotPost {
	id: string;
	title: string;
	views: number;
	url: string;
}

export async function getHotPosts(limit: number = 5): Promise<HotPost[]> {
	try {
		const articles = await djangoApi.fetchHotArticles(limit);
		return articles.map(article => ({
			id: article.id.toString(),
			title: article.title,
			views: article.views,
			url: `/posts/${article.id}/`,
		}));
	} catch (error) {
		console.warn("获取热门文章失败:", error);
		return [];
	}
}

export interface RecentPost {
	id: string;
	title: string;
	published: Date;
	url: string;
}

export async function getRecentPosts(limit: number = 5): Promise<RecentPost[]> {
	try {
		const articles = await djangoApi.fetchRecentArticles(limit);
		return articles.map(article => ({
			id: article.id.toString(),
			title: article.title,
			published: new Date(article.pub_time),
			url: `/posts/${article.id}/`,
		}));
	} catch (error) {
		console.warn("获取近期文章失败:", error);
		return [];
	}
}

export interface StatisticsSummary {
	totalArticles: number;
	totalViews: number;
	totalCategories: number;
	totalTags: number;
	totalLikes: number;
}

export async function getStatisticsSummary(): Promise<StatisticsSummary> {
	try {
		const articles = await djangoApi.fetchAllArticles();
		const categories = await djangoApi.fetchCategories();
		const tags = await djangoApi.fetchTags();
		
		const totalViews = articles.reduce((sum, article) => sum + (article.views || 0), 0);
		const totalLikes = articles.reduce((sum, article) => sum + (article.likes || 0), 0);
		
		return {
			totalArticles: articles.length,
			totalViews,
			totalCategories: categories.length,
			totalTags: tags.length,
			totalLikes,
		};
	} catch (error) {
		console.warn("获取统计摘要失败:", error);
		return {
			totalArticles: 0,
			totalViews: 0,
			totalCategories: 0,
			totalTags: 0,
			totalLikes: 0,
		};
	}
}

export interface TopArticle {
	title: string;
	views: number;
}

export async function getTopArticles(limit: number = 10): Promise<TopArticle[]> {
	try {
		const articles = await djangoApi.fetchTopArticles(limit);
		return articles.map(article => ({
			title: article.title,
			views: article.views,
		}));
	} catch (error) {
		console.warn("获取热门文章排行失败:", error);
		return [];
	}
}

export interface CategoryStat {
	name: string;
	value: number;
}

export async function getCategoryStats(): Promise<CategoryStat[]> {
	try {
		return await djangoApi.fetchCategoryStats();
	} catch (error) {
		console.warn("获取分类统计失败:", error);
		return [];
	}
}