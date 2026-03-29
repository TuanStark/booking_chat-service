import sanitizeHtml from 'sanitize-html';

/** Strip ALL HTML tags from chat messages to prevent XSS. */
export function sanitizeMessageContent(content: string): string {
  return sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} }).trim();
}

/** Truncate text for denormalized preview fields (max 200 chars). */
export function truncatePreview(text: string, maxLength = 200): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
