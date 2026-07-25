export function cleanExtractedText(text: string): string {
  if (!text) return '';

  let cleaned = text
    // Remove null characters & weird control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize zero-width spaces
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Replace non-breaking spaces with standard space
    .replace(/\u00A0/g, ' ')
    // Normalize Windows/Mac line endings to Unix \n
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Replace tabs with spaces
    .replace(/\t/g, ' ')
    // Reduce multiple horizontal spaces to single space
    .replace(/[ \t]{2,}/g, ' ');

  // Collapse 3+ consecutive linebreaks into double linebreak (paragraph break)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Trim leading/trailing whitespace per line
  cleaned = cleaned
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();

  return cleaned;
}
