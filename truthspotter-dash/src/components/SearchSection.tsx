"use client"

import { Search, Sparkles, TrendingUp, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface SearchSectionProps {
  onSearch: (query: string) => void
  isSearching?: boolean
}

export function SearchSection({ onSearch, isSearching = false }: SearchSectionProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const query = formData.get("search") as string
    if (query.trim()) {
      onSearch(query.trim())
      // Clear the input after search
      const form = e.currentTarget
      form.reset()
    }
  }

  const exampleClaims = [
    "Drinking 8 glasses of water daily is essential for health",
    "5G networks cause cancer",
    "Electric cars are worse for the environment than gas cars",
    "Eating carrots improves your night vision"
  ]

  const handleExampleClick = (claim: string) => {
    onSearch(claim)
  }

  return (
    <Card className="w-full border-2 border-primary/20 bg-gradient-to-br from-background to-primary/5">
      <CardContent className="p-6 space-y-6">
        {/* Main Search Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="search"
              placeholder="Enter any claim you want to fact-check..."
              className="pl-12 pr-32 h-14 text-lg border-2 border-border focus:border-primary"
              disabled={isSearching}
            />
            <Button 
              type="submit" 
              size="lg"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10"
              disabled={isSearching}
            >
              {isSearching ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-background border-t-transparent mr-2" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Verify Claim
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Quick Stats */}
        <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span>99.2% accuracy rate</span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span>50+ trusted sources</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span>Real-time verification</span>
          </div>
        </div>

        {/* Example Claims */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-center">Try these example claims:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {exampleClaims.map((claim, index) => (
              <Badge
                key={index}
                variant="outline"
                className="cursor-pointer hover:bg-primary/10 hover:border-primary/50 transition-colors px-3 py-2 text-xs max-w-xs"
                onClick={() => handleExampleClick(claim)}
              >
                {claim}
              </Badge>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            💡 <strong>Pro tip:</strong> Be specific with your claims for more accurate results
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
