import { resolveApiUrl } from '@/api/apiClient';

/**
 * @param {string} value
 */
function normalizeDisplayText(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const withSpacing = raw.replace(/^(\d+(?:\.\d+)+)([A-Za-zА-Яа-яІіЇїЄєҐґ])/, '$1 $2');
  return withSpacing.replace(/^([a-zа-яіїєґ])/, (match) => match.toUpperCase());
}

/**
 * @param {any} value
 */
export function normalizeTheoryCategory(value) {
  return {
    slug: String(value?.slug || ''),
    title: normalizeDisplayText(value?.title || ''),
    description: normalizeDisplayText(value?.description || ''),
    sortOrder: Number(value?.sort_order || 0),
  };
}

/**
 * @param {any} value
 */
export function normalizeTheoryTopic(value) {
  return {
    id: Number(value?.id || 0),
    slug: String(value?.slug || ''),
    title: normalizeDisplayText(value?.title || ''),
    description: normalizeDisplayText(value?.description || ''),
    topicType: String(value?.topic_type || ''),
    sortOrder: Number(value?.sort_order || 0),
    sourceUrl: String(value?.source_url || ''),
  };
}

/**
 * @param {any} value
 */
export function normalizeTheoryAsset(value) {
  return {
    type: String(value?.asset_type || ''),
    localUrl: resolveApiUrl(String(value?.asset_url || '')) || '',
    caption: String(value?.caption || ''),
    altText: String(value?.alt_text || ''),
    sortOrder: Number(value?.sort_order || 0),
  };
}

/**
 * @param {string} html
 */
function normalizeContentHtml(html) {
  const raw = String(html || '');
  if (!raw) return '';

  return raw.replace(/(<(?:img|source)\b[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/gi, (_, prefix, path, suffix) => {
    const resolved = resolveApiUrl(path) || resolveApiUrl(path.startsWith('/') ? path : `/${path}`) || path;
    return `${prefix}${resolved}${suffix}`;
  });
}

/**
 * @param {any} value
 */
export function normalizeTheorySection(value) {
  return {
    id: Number(value?.id || 0),
    slug: String(value?.slug || ''),
    title: normalizeDisplayText(value?.title || ''),
    description: normalizeDisplayText(value?.description || ''),
    chapterNum: value?.chapter_num == null ? null : Number(value.chapter_num),
    sortOrder: Number(value?.sort_order || 0),
    sourceUrl: String(value?.source_url || ''),
    topicSlug: String(value?.topic_slug || ''),
    topicTitle: normalizeDisplayText(value?.topic_title || ''),
    categorySlug: String(value?.category_slug || ''),
    categoryTitle: normalizeDisplayText(value?.category_title || ''),
    contentHtml: normalizeContentHtml(value?.content_html || ''),
    commentHtml: String(value?.comment_html || ''),
    videoUrl: resolveApiUrl(String(value?.video_url || '')) || '',
    embedUrl: String(value?.embed_url || ''),
    assets: Array.isArray(value?.assets) ? value.assets.map(normalizeTheoryAsset) : [],
  };
}
