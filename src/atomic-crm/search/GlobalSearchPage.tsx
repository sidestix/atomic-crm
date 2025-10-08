import { useState, useCallback, useMemo } from "react";
import { useDataProvider } from "ra-core";
import { Search, User, FileText, Building2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/useDebounce";
import { Link } from "react-router";

export interface SearchResult {
  id: string;
  type: "contact" | "note" | "company";
  title: string;
  subtitle?: string;
  snippet: string;
  url: string;
  metadata?: Record<string, any>;
}

export const GlobalSearchPage = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const dataProvider = useDataProvider();

  // Debounce search query to avoid excessive API calls
  const debouncedQuery = useDebounce(query, 300);

  const search = useCallback(
    async (searchQuery: string, pageNum: number = 1) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setHasMore(false);
        return;
      }

      setLoading(true);
      try {
        const response = await dataProvider.globalSearch({
          query: searchQuery,
          page: pageNum,
          limit: 10,
        });

        if (pageNum === 1) {
          setResults(response.data);
        } else {
          setResults(prev => [...prev, ...response.data]);
        }
        
        setHasMore(response.hasMore || false);
        setPage(pageNum);
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [dataProvider]
  );

  // Trigger search when debounced query changes
  useMemo(() => {
    if (debouncedQuery) {
      search(debouncedQuery, 1);
    } else {
      setResults([]);
      setHasMore(false);
    }
  }, [debouncedQuery, search]);

  const handleLoadMore = () => {
    if (debouncedQuery && !loading) {
      search(debouncedQuery, page + 1);
    }
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case "contact":
        return <User className="h-4 w-4" />;
      case "note":
        return <FileText className="h-4 w-4" />;
      case "company":
        return <Building2 className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  const getResultBadgeColor = (type: string) => {
    switch (type) {
      case "contact":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "note":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "company":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Search</h1>
        <p className="text-muted-foreground">
          Search across contacts, notes, and companies
        </p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Start typing to search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 h-12 text-lg"
          autoFocus
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {query && (
        <div className="space-y-4">
          {results.length > 0 ? (
            <>
              <div className="space-y-3">
                {results.map((result) => (
                  <Card key={`${result.type}-${result.id}`} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <Link to={result.url} className="block">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {getResultIcon(result.type)}
                          </div>
                          <div className="flex-grow min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-sm truncate">
                                {highlightText(result.title, query)}
                              </h3>
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${getResultBadgeColor(result.type)}`}
                              >
                                {result.type}
                              </Badge>
                            </div>
                            {result.subtitle && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {highlightText(result.subtitle, query)}
                              </p>
                            )}
                            <p className="text-sm text-muted-foreground">
                              {highlightText(result.snippet, query)}
                            </p>
                          </div>
                        </div>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {hasMore && (
                <div className="text-center pt-4">
                  <Button 
                    onClick={handleLoadMore} 
                    disabled={loading}
                    variant="outline"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Show more"
                    )}
                  </Button>
                </div>
              )}
            </>
          ) : !loading && query ? (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No results found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search terms or check for typos
              </p>
            </div>
          ) : null}
        </div>
      )}

      {!query && (
        <div className="text-center py-12">
          <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Start your search</h3>
          <p className="text-muted-foreground">
            Enter a search term to find contacts, notes, and companies
          </p>
        </div>
      )}
    </div>
  );
};
