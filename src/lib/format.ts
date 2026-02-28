/**
 * 閲覧数をフォーマットして表示用文字列を返す
 */
export function formatViews(views: number): string {
    if (views >= 10000) return `${(views / 10000).toFixed(1)}万`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return `${views}`;
}
