"use client"

import { useState } from "react"
import { Check, Star, Shield, ArrowLeft, ExternalLink, Moon, Sun, Menu, HelpCircle, Settings, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface PricingPlan {
  name: string
  price: number
  currency: string
  period: string
  description: string
  features: string[]
  buttonText: string
  popular?: boolean
  current?: boolean
}

const plans: PricingPlan[] = [
  {
    name: "Free",
    price: 0,
    currency: "INR",
    period: "month",
    description: "Intelligence for everyday tasks",
    features: [
      "Access to basic fact-checking",
      "5 verifications per day",
      "Limited source analysis",
      "Basic verification history",
      "Community support"
    ],
    buttonText: "Current Plan",
    current: true
  },
  {
    name: "Go",
    price: 399,
    currency: "INR",
    period: "month (inclusive of GST)",
    description: "More access to popular features",
    features: [
      "Access to advanced fact-checking",
      "50 verifications per day",
      "Expanded source analysis",
      "Detailed verification reports",
      "Priority support",
      "Export verification history"
    ],
    buttonText: "Upgrade to Go",
    popular: true
  },
  {
    name: "Plus",
    price: 1999,
    currency: "INR",
    period: "month (inclusive of GST)",
    description: "More access to advanced intelligence",
    features: [
      "Advanced fact-checking with ML",
      "200 verifications per day",
      "Comprehensive source analysis",
      "Real-time claim monitoring",
      "API access",
      "Advanced analytics dashboard",
      "Custom verification alerts",
      "Premium support"
    ],
    buttonText: "Get Plus"
  },
  {
    name: "Pro",
    price: 19900,
    currency: "INR",
    period: "month (inclusive of GST)",
    description: "Full access to the best of TruthSpotter",
    features: [
      "Enterprise-grade fact-checking",
      "Unlimited verifications",
      "AI-powered trend analysis",
      "Custom ML model training",
      "White-label solutions",
      "Dedicated account manager",
      "24/7 enterprise support",
      "Advanced integration options",
      "Custom reporting"
    ],
    buttonText: "Get Pro"
  }
]

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

// Top Navigation for Pricing Page
function PricingNavigation({ onNavigateBack }: { onNavigateBack?: () => void }) {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center space-x-4">
          {onNavigateBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateBack}
              className="hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          )}
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

// Main Pricing Page Component
export default function PricingPage({ onNavigateBack }: { onNavigateBack?: () => void }) {
  const [billingCycle, setBillingCycle] = useState<"personal" | "business">("personal")

  const formatPrice = (price: number, currency: string) => {
    if (price === 0) return "0"
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency === 'INR' ? 'INR' : 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <PricingNavigation onNavigateBack={onNavigateBack} />

      {/* Main Content */}
      <main className="container py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Select the perfect plan for your fact-checking needs. Upgrade or downgrade at any time.
          </p>
          
          {/* Billing Toggle */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center bg-muted rounded-lg p-1">
              <button
                onClick={() => setBillingCycle("personal")}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-all",
                  billingCycle === "personal"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Personal
              </button>
              <button
                onClick={() => setBillingCycle("business")}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-all",
                  billingCycle === "business"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Business
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {plans.map((plan, index) => (
            <Card
              key={plan.name}
              className={cn(
                "relative transition-all hover:shadow-lg",
                plan.popular && "border-primary shadow-lg scale-105",
                plan.current && "border-green-500"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1">
                    <Star className="h-3 w-3 mr-1" />
                    NEW
                  </Badge>
                </div>
              )}
              
              {plan.current && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 px-3 py-1">
                    Current Plan
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold">
                    {formatPrice(plan.price, plan.currency)}
                  </span>
                  <span className="text-muted-foreground text-sm ml-1">
                    /{plan.period.split(' ')[0]}
                  </span>
                </div>
                {plan.period.includes('GST') && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {plan.period}
                  </p>
                )}
                <p className="text-sm text-muted-foreground mt-4">
                  {plan.description}
                </p>
              </CardHeader>

              <CardContent className="space-y-4">
                <Button
                  className={cn(
                    "w-full",
                    plan.popular && "bg-primary hover:bg-primary/90",
                    plan.current && "bg-muted text-muted-foreground cursor-default hover:bg-muted"
                  )}
                  variant={plan.popular ? "default" : "outline"}
                  disabled={plan.current}
                >
                  {plan.buttonText}
                </Button>

                <div className="space-y-3">
                  {plan.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-start space-x-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">How accurate is TruthSpotter?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  TruthSpotter uses advanced AI and cross-references multiple credible sources to achieve high accuracy rates. Our system continuously learns and improves its fact-checking capabilities.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Can I change my plan anytime?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and billing adjustments are prorated.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What sources does TruthSpotter check?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We check thousands of credible sources including news outlets, academic journals, government databases, and fact-checking organizations to provide comprehensive verification.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Is there an API available?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Yes, API access is available with Plus and Pro plans. This allows you to integrate TruthSpotter's fact-checking capabilities into your own applications.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-16">
          <Card className="max-w-2xl mx-auto bg-gradient-to-r from-primary/10 to-blue-600/10 border-primary/20">
            <CardHeader>
              <CardTitle className="text-2xl">Ready to get started?</CardTitle>
              <p className="text-muted-foreground">
                Join thousands of users who trust TruthSpotter for accurate fact-checking.
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="bg-primary hover:bg-primary/90">
                  Start Free Trial
                </Button>
                <Button size="lg" variant="outline">
                  Contact Sales
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/50 mt-16">
        <div className="container py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-semibold">TruthSpotter</span>
            </div>
            <div className="flex space-x-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground flex items-center gap-1">
                Terms of Service
                <ExternalLink className="h-3 w-3" />
              </a>
              <a href="#" className="hover:text-foreground flex items-center gap-1">
                Privacy Policy
                <ExternalLink className="h-3 w-3" />
              </a>
              <a href="#" className="hover:text-foreground flex items-center gap-1">
                Contact
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
