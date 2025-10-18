import { CheckCircle, XCircle, AlertCircle, ExternalLink, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type VerificationStatus = "verified-true" | "verified-false" | "unverified" | "loading"

export interface EvidenceSource {
  id: string
  title: string
  source: string
  url: string
  credibility: number
  summary: string
}

export interface VerificationResult {
  id: string
  claim: string
  status: VerificationStatus
  confidence: number
  evidenceSources: EvidenceSource[]
  timestamp: Date
  summary?: string
}

interface VerificationResultsProps {
  result: VerificationResult | null
  isLoading?: boolean
}

export function VerificationResults({ result, isLoading = false }: VerificationResultsProps) {
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="p-8">
          <div className="flex items-center justify-center space-x-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="space-y-2">
              <p className="text-lg font-medium">Analyzing claim...</p>
              <p className="text-sm text-muted-foreground">
                Checking multiple sources and cross-referencing facts
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!result) {
    return (
      <Card className="w-full border-2 border-dashed border-muted">
        <CardContent className="p-8">
          <div className="text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium">No claim to verify</h3>
              <p className="text-sm text-muted-foreground">
                Enter a claim in the search bar above to get started with fact-checking.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getStatusConfig = (status: VerificationStatus) => {
    switch (status) {
      case "verified-true":
        return {
          icon: CheckCircle,
          label: "Verified True",
          variant: "verified-true" as const,
          className: "bg-verified-true text-verified-true-foreground"
        }
      case "verified-false":
        return {
          icon: XCircle,
          label: "Verified False",
          variant: "verified-false" as const,
          className: "bg-verified-false text-verified-false-foreground"
        }
      case "unverified":
        return {
          icon: AlertCircle,
          label: "Unverified",
          variant: "unverified" as const,
          className: "bg-unverified text-unverified-foreground"
        }
      default:
        return {
          icon: AlertCircle,
          label: "Processing",
          variant: "secondary" as const,
          className: "bg-secondary text-secondary-foreground"
        }
    }
  }

  const statusConfig = getStatusConfig(result.status)
  const StatusIcon = statusConfig.icon

  return (
    <div className="space-y-6">
      {/* Main Result Card */}
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <CardTitle className="text-xl">Verification Result</CardTitle>
              <p className="text-muted-foreground">{result.claim}</p>
            </div>
            <Badge 
              className={cn("status-badge", statusConfig.className)}
            >
              <StatusIcon className="mr-2 h-4 w-4" />
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Confidence Score */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Confidence Score</span>
              <span className="text-sm text-muted-foreground">{result.confidence}%</span>
            </div>
            <Progress value={result.confidence} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Based on {result.evidenceSources.length} sources analyzed
            </p>
          </div>

          {/* Summary */}
          {result.summary && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Summary</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {result.summary}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evidence Sources */}
      {result.evidenceSources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evidence Sources</CardTitle>
            <p className="text-sm text-muted-foreground">
              {result.evidenceSources.length} sources analyzed
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {result.evidenceSources.map((source) => (
                <Card key={source.id} className="evidence-card">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-medium leading-tight line-clamp-2">
                          {source.title}
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          {source.credibility}% credible
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {source.source}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {source.summary}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="w-full"
                      >
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Source
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}