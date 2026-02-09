import { createClient } from "@supabase/supabase-js";

// Dynamically determine Supabase URL based on current hostname
export const getSupabaseUrl = (): string => {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const altUrl = import.meta.env.VITE_SUPABASE_ALT_URL;
  
  if (!baseUrl) {
    throw new Error("VITE_SUPABASE_URL is not set");
  }
  
  // In browser, check current hostname and use appropriate URL
  if (typeof window !== 'undefined') {
    const currentHost = window.location.hostname;
    
    // If alt URL is configured and hostname matches, use it
    if (altUrl) {
      try {
        const altUrlObj = new URL(altUrl);
        if (currentHost === altUrlObj.hostname) {
          return altUrl;
        }
      } catch {
        // Continue to fallback
      }
    }
    
    // Parse base URL and check if we need to adjust hostname
    try {
      const baseUrlObj = new URL(baseUrl);
      // If current hostname doesn't match base URL hostname, construct new URL
      if (currentHost !== baseUrlObj.hostname && 
          currentHost !== 'localhost' && 
          currentHost !== '127.0.0.1') {
        // Use current hostname with same port/protocol as base URL
        return `${baseUrlObj.protocol}//${currentHost}:${baseUrlObj.port || '54321'}`;
      }
    } catch {
      // If parsing fails, return base URL
    }
  }
  
  return baseUrl;
};

export const supabase = createClient(
  getSupabaseUrl(),
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
