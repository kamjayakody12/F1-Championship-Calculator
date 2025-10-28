/**
 * GET /api/cache-stats
 * 
 * Returns cache statistics for monitoring and debugging.
 * Useful for understanding cache performance and hit rates.
 * 
 * Returns:
 * {
 *   totalEntries: number,
 *   totalSize: number (bytes),
 *   hits: number,
 *   misses: number,
 *   evictions: number,
 *   hitRate: number (percentage)
 * }
 */

import { NextResponse } from "next/server";
import { apiCache } from "@/lib/cache";

export async function GET() {
  const stats = apiCache.getStats();
  
  // Calculate hit rate
  const totalRequests = stats.hits + stats.misses;
  const hitRate = totalRequests > 0 
    ? ((stats.hits / totalRequests) * 100).toFixed(2)
    : 0;

  return NextResponse.json({
    ...stats,
    hitRate: `${hitRate}%`,
    totalSizeMB: (stats.totalSize / (1024 * 1024)).toFixed(2),
    timestamp: new Date().toISOString()
  });
}

/**
 * DELETE /api/cache-stats
 * 
 * Clears the entire cache.
 * Useful for debugging or forcing fresh data.
 */
export async function DELETE() {
  apiCache.clear();
  
  return NextResponse.json({
    success: true,
    message: "Cache cleared successfully"
  });
}
