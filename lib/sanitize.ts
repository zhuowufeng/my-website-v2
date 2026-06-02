// lib/sanitize.ts
// Input/output sanitization utilities

/**
 * Sanitize user input: only allow English letters, spaces, hyphens, apostrophes, and periods
 */
export function sanitizeInput(name: string): string {
  return name
    .replace(/[^a-zA-Z\s\-'.]/g, '') // Only allow letters, spaces, hyphens, apostrophes, periods
    .trim()
    .substring(0, 50); // Limit length
}

/**
 * Sanitize AI output: escape HTML special characters to prevent XSS
 */
export function sanitizeOutput(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Truncate string to max length
 */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 3) + '...';
}
