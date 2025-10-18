import { Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { VerificationResult, VerificationStatus } from "./VerificationResults"

interface HistoryProps {
  history: VerificationResult[]
  onSelectResult: (result: VerificationResult) => void
  selectedResultId?: string
}

export function History({ history, onSelectResult, selectedResultId }: HistoryProps) {
  const getStatusConfig = (status: VerificationStatus) => {
    switch (status) {
      case "verified-true":
        return {
          icon: CheckCircle,
          label: "True",
          className: "bg-verified-true-light text-verified-true border-verified-true/20"
        }
      case "verified-false":
        return {
          icon: XCircle,
          label: "False",
          className: "bg-verified-false-light text-verified-false border-verified-false/20"
        }
      case "unverified":
        return {
          icon: AlertCircle,
          label: "Unverified",
          className: "bg-unverified-light text-unverified border-unverified/20"
        }
      default:
        return {
          icon: AlertCircle,
          label: "Processing",
          className: "bg-secondary text-secondary-foreground"
        }
    }
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) {
      return `${diffDays}d ago`
    } else if (diffHours > 0) {
      return `${diffHours}h ago`
    } else {
      return "Just now"
    }
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Recent Verifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              No verification history yet. Start by verifying your first claim!
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5" />
          Recent Verifications
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {history.length} claim{history.length !== 1 ? 's' : ''} verified
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[600px]">
          <div className="space-y-2 p-4">
            {history.map((result) => {
              const statusConfig = getStatusConfig(result.status)
              const StatusIcon = statusConfig.icon
              const isSelected = selectedResultId === result.id

              return (
                <div
                  key={result.id}
                  className={cn(
                    "p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md",
                    isSelected 
                      ? "border-primary bg-accent" 
                      : "border-border hover:border-primary/50"
                  )}
                  onClick={() => onSelectResult(result)}
                >
                  <div className="space-y-3">
                    {/* Header with status and time */}
                    <div className="flex items-start justify-between gap-2">
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs", statusConfig.className)}
                      >
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {statusConfig.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(result.timestamp)}
                      </span>
                    </div>

                    {/* Claim text */}
                    <p className="text-sm line-clamp-3 leading-relaxed">
                      {result.claim}
                    </p>

                    {/* Confidence and sources count */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{result.confidence}% confidence</span>
                      <span>{result.evidenceSources.length} sources</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}