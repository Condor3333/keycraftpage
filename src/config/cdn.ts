

// CloudFront distribution URLs - Note: Background images and thumbnails now use signed URLs
export const CDN_URLS = {
  PROJECT_DATA: process.env.CLOUDFRONT_PROJECT_DATA_URL || `https://${process.env.S3_PROJECT_DATA_BUCKET}.s3.amazonaws.com`,
  // REMOVED: BACKGROUND_IMAGES - now uses signed URLs to avoid caching issues
  // REMOVED: THUMBNAILS - now uses signed URLs to avoid caching issues  
  PUBLIC_ASSETS: process.env.NEXT_PUBLIC_CDN_URL || '', // For landing page assets only
} as const;

// Note: getCdnUrl function removed as background images now use signed URLs
// This eliminates CloudFront caching issues for dynamic content

// Renamed and generalized from getVideoUrl
export function getPublicAssetUrl(assetPath: string): string {
  // If a CDN URL for public assets is configured, prepend it.
  // Otherwise, return the path as is, so it works locally from the /public folder.
  if (CDN_URLS.PUBLIC_ASSETS) {
    // Remove leading slash from assetPath if it exists, to prevent double slashes
    const cleanAssetPath = assetPath.startsWith('/') ? assetPath.substring(1) : assetPath;
    return `${CDN_URLS.PUBLIC_ASSETS}/${cleanAssetPath}`;
  }
  return assetPath; // Fallback for local development or if URL is not set
}

// Helper function to determine if a URL is from our CDN
export function isCdnUrl(url: string): boolean {
  // Check against all non-empty CDN URLs
  return Object.values(CDN_URLS).some(cdnUrl => cdnUrl && url.startsWith(cdnUrl));
}

// Helper function to get original S3 key from CDN URL
export function getKeyFromCdnUrl(url: string): string | null {
  for (const cdnUrl of Object.values(CDN_URLS)) {
    // Ensure URL is valid and the passed url starts with it
    if (cdnUrl && url.startsWith(cdnUrl)) {
      // Remove the CDN base URL and any query parameters
      const keyWithParams = url.slice(cdnUrl.length + 1); // +1 for the trailing slash
      return keyWithParams.split('?')[0]; // Remove query parameters
    }
  }
  return null;
} 