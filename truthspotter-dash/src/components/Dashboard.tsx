"use client"

import { useState, useRef, useEffect } from "react"
import { Search, Shield, CheckCircle, XCircle, AlertCircle, ExternalLink, Loader2, Clock, Moon, Sun, Menu, X, HelpCircle, Settings, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

interface ChatMessage {
  id: string
  type: "user" | "assistant"
  content: string
  result?: VerificationResult
  isLoading?: boolean
}

// Mock data for demonstration
const mockHistory: VerificationResult[] = [
  {
    id: "1",
    claim: "The Earth is flat and space agencies are hiding this truth from the public.",
    status: "verified-false",
    confidence: 95,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    summary: "This claim has been thoroughly debunked by overwhelming scientific evidence. The Earth is an oblate spheroid, as confirmed by satellite imagery, physics, and direct observation.",
    evidenceSources: [
      {
        id: "s1",
        title: "NASA Satellite Images Show Earth's Curvature",
        source: "NASA",
        url: "https://nasa.gov",
        credibility: 98,
        summary: "High-resolution satellite imagery clearly demonstrates Earth's spherical nature and curvature."
      },
      {
        id: "s2", 
        title: "Scientific Consensus on Earth's Shape",
        source: "Nature Science Journal",
        url: "https://nature.com",
        credibility: 96,
        summary: "Comprehensive review of geological, astronomical, and physical evidence supporting Earth's spherical shape."
      }
    ]
  },
  {
    id: "2",
    claim: "Climate change is primarily caused by human activities, particularly greenhouse gas emissions.",
    status: "verified-true",
    confidence: 97,
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    summary: "Scientific consensus strongly supports human activities as the primary driver of current climate change, with greenhouse gas emissions being the main contributor.",
    evidenceSources: [
      {
        id: "s3",
        title: "IPCC Climate Change Report 2023",
        source: "Intergovernmental Panel on Climate Change",
        url: "https://ipcc.ch",
        credibility: 99,
        summary: "Comprehensive assessment by thousands of climate scientists confirms human influence on climate system."
      }
    ]
  },
  {
    id: "3",
    claim: "A new study claims that drinking coffee daily can extend your lifespan by 10 years.",
    status: "unverified",
    confidence: 45,
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    summary: "While some studies suggest coffee may have health benefits, the specific claim of 10-year lifespan extension lacks sufficient peer-reviewed evidence and may be exaggerated.",
    evidenceSources: [
      {
        id: "s4",
        title: "Coffee and Longevity: A Meta-Analysis",
        source: "Journal of Nutrition",
        url: "https://example.com",
        credibility: 78,
        summary: "Meta-analysis shows moderate positive association between coffee consumption and longevity, but results vary."
      }
    ]
  }
]

// Enhanced Navigation Component
function TopNavigation({ sidebarOpen, onToggleSidebar }: { 
  sidebarOpen: boolean
  onToggleSidebar: () => void 
}) {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Left side with menu and logo */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSidebar}
            className="hover:bg-accent"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div className="flex items-center space-x-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              TruthSpotter
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex items-center space-x-4">
          {/* Help Button */}
          <Button variant="ghost" size="sm" className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Help</span>
          </Button>

          {/* Settings Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Preferences</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <span>Language</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <span>Notifications</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <span>Export History</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <span>About TruthSpotter</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Account</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <span>Sign In</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <span>Create Account</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <span>Privacy Policy</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <span>Terms of Service</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme Toggle */}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}

// Theme Toggle Component
function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className="w-9 h-9 p-0"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}

// Sidebar Component
function Sidebar({ history, onSelectResult, isOpen, onToggle }: {
  history: VerificationResult[]
  onSelectResult: (result: VerificationResult) => void
  isOpen: boolean
  onToggle: () => void
}) {
  const getStatusConfig = (status: VerificationStatus) => {
    switch (status) {
      case "verified-true":
        return {
          icon: CheckCircle,
          label: "True",
          className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/20"
        }
      case "verified-false":
        return {
          icon: XCircle,
          label: "False",
          className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/20"
        }
      case "unverified":
        return {
          icon: AlertCircle,
          label: "Unverified",
          className: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800/20"
        }
      default:
        return {
          icon: AlertCircle,
          label: "Processing",
          className: "bg-gray-100 text-gray-800 border-gray-200"
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

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={onToggle} />
      )}
      
      {/* Sidebar */}
      <div className={cn(
        "fixed left-0 top-0 h-full w-80 bg-background border-r z-50 transform transition-transform duration-200 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold">Recent Verifications</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* History List */}
          <ScrollArea className="flex-1 p-4">
            {history.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  No verification history yet. Start by verifying your first claim!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((result) => {
                  const statusConfig = getStatusConfig(result.status)
                  const StatusIcon = statusConfig.icon

                  return (
                    <div
                      key={result.id}
                      className="p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md hover:border-primary/50 hover:border-primary/50 hover:bg-accent/50"
                      onClick={() => {
                        onSelectResult(result)
                      }}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs", statusConfig.className)}
                          >
                            <StatusIcon className="mr-1 h-3 w-3" />
                            {statusConfig.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(result.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm line-clamp-2 leading-relaxed">
                          {result.claim}
                        </p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{result.confidence}% confidence</span>
                          <span>{result.evidenceSources.length} sources</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </>
  )
}

// Chat Message Component
function ChatMessageComponent({ message }: { message: ChatMessage }) {
  const getStatusConfig = (status: VerificationStatus) => {
    switch (status) {
      case "verified-true":
        return {
          icon: CheckCircle,
          label: "Verified True",
          className: "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800/20 dark:text-green-400"
        }
      case "verified-false":
        return {
          icon: XCircle,
          label: "Verified False",
          className: "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800/20 dark:text-red-400"
        }
      case "unverified":
        return {
          icon: AlertCircle,
          label: "Unverified",
          className: "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800/20 dark:text-yellow-400"
        }
      default:
        return {
          icon: AlertCircle,
          label: "Processing",
          className: "bg-gray-50 border-gray-200 text-gray-800"
        }
    }
  }

  if (message.type === "user") {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-3xl bg-primary text-primary-foreground rounded-lg px-4 py-2">
          <p className="text-sm">{message.content}</p>
        </div>
      </div>
    )
  }

  if (message.isLoading) {
    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-4xl bg-muted rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium">Analyzing claim...</p>
              <p className="text-xs text-muted-foreground">
                Checking multiple sources and cross-referencing facts
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!message.result) {
    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-4xl bg-muted rounded-lg p-4">
          <p className="text-sm">Unable to verify this claim. Please try again.</p>
        </div>
      </div>
    )
  }

  const result = message.result
  const statusConfig = getStatusConfig(result.status)
  const StatusIcon = statusConfig.icon

  return (
    <div className="flex justify-start mb-6">
      <div className="max-w-4xl w-full space-y-4">
        {/* Main Result */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <CardTitle className="text-lg">Verification Result</CardTitle>
              <Badge className={cn("status-badge", statusConfig.className)}>
                <StatusIcon className="mr-2 h-4 w-4" />
                {statusConfig.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Confidence Score */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Confidence Score</span>
                <span className="text-sm text-muted-foreground">{result.confidence}%</span>
              </div>
              <Progress value={result.confidence} className="h-2" />
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
              <CardTitle className="text-base">Evidence Sources</CardTitle>
              <p className="text-sm text-muted-foreground">
                {result.evidenceSources.length} sources analyzed
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {result.evidenceSources.map((source) => (
                  <Card key={source.id} className="border">
                    <CardContent className="p-3">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-medium leading-tight line-clamp-2">
                            {source.title}
                          </h4>
                          <Badge variant="outline" className="text-xs">
                            {source.credibility}%
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {source.source}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {source.summary}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="w-full h-7 text-xs"
                        >
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1"
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
    </div>
  )
}

export default function Dashboard() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [history] = useState<VerificationResult[]>(mockHistory)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  // Helper functions for sidebar
  const getStatusConfig = (status: VerificationStatus) => {
    switch (status) {
      case "verified-true":
        return {
          icon: CheckCircle,
          label: "True",
          className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/20"
        }
      case "verified-false":
        return {
          icon: XCircle,
          label: "False",
          className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/20"
        }
      case "unverified":
        return {
          icon: AlertCircle,
          label: "Unverified",
          className: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800/20"
        }
      default:
        return {
          icon: AlertCircle,
          label: "Processing",
          className: "bg-gray-100 text-gray-800 border-gray-200"
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

const handleSearch = async (query: string) => {
  if (!query.trim() || isLoading) return;

  const userMessage: ChatMessage = {
    id: Date.now().toString(),
    type: "user",
    content: query
  };

  const loadingMessage: ChatMessage = {
    id: (Date.now() + 1).toString(),
    type: "assistant",
    content: "",
    isLoading: true
  };

  setMessages(prev => [...prev, userMessage, loadingMessage]);
  setIsLoading(true);

  if (inputRef.current) {
    inputRef.current.value = "";
  }

  try {
    // Call your backend API
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_KEY}` // Add this to .env.local
      },
      body: JSON.stringify({
        message: query,
        session_id: currentSessionId // Add session tracking
      })
    });

    if (!response.ok) {
      throw new Error('Failed to verify claim');
    }

    const data = await response.json();
    
    // Transform backend response to your VerificationResult format
    const result: VerificationResult = {
      id: data.data.id,
      claim: query,
      status: data.data.verification_status || "unverified",
      confidence: data.data.confidence || 0,
      timestamp: new Date(),
      summary: data.data.summary,
      evidenceSources: data.data.sources || []
    };

    setMessages(prev => 
      prev.map(msg => 
        msg.isLoading 
          ? { ...msg, isLoading: false, result }
          : msg
      )
    );
  } catch (error) {
    console.error('Verification error:', error);
    setMessages(prev => 
      prev.map(msg => 
        msg.isLoading 
          ? { 
              ...msg, 
              isLoading: false, 
              content: "Sorry, I couldn't verify this claim. Please try again." 
            }
          : msg
      )
    );
  } finally {
    setIsLoading(false);
  }
};

  const handleSelectHistoryResult = (result: VerificationResult) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: result.claim
    }

    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: "assistant",
      content: "",
      result: result
    }

    setMessages(prev => [...prev, userMessage, assistantMessage])
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const input = inputRef.current
    if (input && input.value.trim()) {
      handleSearch(input.value.trim())
    }
  }

  return (
    <div className="h-screen bg-background">
      {/* Sidebar */}
      <Sidebar
        history={history}
        onSelectResult={handleSelectHistoryResult}
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
      />
      
      {/* Main Content */}
      <div className={cn("flex-1 flex flex-col transition-all duration-200", sidebarOpen ? "lg:ml-80" : "ml-0")}>
        {/* Header */}
        <TopNavigation sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
        
        {/* Chat Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 px-4 pb-24">
            <div className="max-w-4xl mx-auto py-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12">
                  <div className="text-center space-y-4">
                    <Shield className="h-16 w-16 text-primary mx-auto" />
                    <h1 className="text-3xl font-bold">Welcome to TruthSpotter</h1>
                    <p className="text-muted-foreground max-w-md">
                      Enter a claim below to verify its accuracy using our advanced fact-checking system.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <ChatMessageComponent key={message.id} message={message} />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Fixed Input Area */}
        <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-4 z-50" style={{ left: sidebarOpen ? '320px' : '0px' }}>
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <Input
                ref={inputRef}
                placeholder="Enter a claim to verify..."
                className="pr-24 py-3"
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e)
                  }
                }}
              />
              <Button 
                onClick={handleSubmit}
                size="sm" 
                className="absolute right-2 top-1/2 -translate-y-1/2"
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}