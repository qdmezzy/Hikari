"use client"

import { useState } from "react"
import { Navigation } from "@/components/Navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Heart, Zap, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

export default function PremiumPage() {
  const [billingPeriod, setBillingPeriod] = useState("yearly")
  const [selectedPlan, setSelectedPlan] = useState("yearly")

  const plans = [
    {
      id: "monthly",
      name: "Supporter",
      price: 5,
      period: "month",
      popular: false,
    },
    {
      id: "yearly",
      name: "Patron",
      price: 4,
      period: "month",
      billed: 48,
      popular: true,
      savings: "Give yearly",
    },
    {
      id: "lifetime",
      name: "Lifetime Backer",
      price: 99,
      period: "once",
      popular: false,
      badge: "Best Value",
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="pb-24 pt-20 md:pb-8">
        {/* Hero */}
        <section className="relative overflow-hidden px-4 py-12 md:py-20">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/20 rounded-full blur-[120px]" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-[120px]" />
          </div>

          <div className="relative mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
              <Heart className="h-5 w-5 text-amber-400" />
              <span className="text-amber-400 font-medium">Support Hikari</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Donate to keep
              <br />
              <span className="text-amber-400">Hikari thriving</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-12">
              Your support helps cover hosting, keeps the app fast, and funds the next wave of features.
            </p>

            {/* Pricing Toggle */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <span className={cn("text-sm font-medium", billingPeriod === "monthly" ? "text-foreground" : "text-muted-foreground")}>
                Monthly
              </span>
              <Switch
                checked={billingPeriod === "yearly"}
                onCheckedChange={(checked) => {
                  setBillingPeriod(checked ? "yearly" : "monthly")
                  setSelectedPlan(checked ? "yearly" : "monthly")
                }}
              />
              <span className={cn("text-sm font-medium", billingPeriod === "yearly" ? "text-foreground" : "text-muted-foreground")}>
                Yearly
              </span>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Give yearly</Badge>
            </div>

            {/* Pricing Cards */}
            <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto mb-8">
              {plans.map((plan) => (
                <Card
                  key={plan.id}
                  className={cn(
                    "relative cursor-pointer transition-all duration-300 overflow-hidden",
                    selectedPlan === plan.id
                      ? "bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/50 scale-105 shadow-xl"
                      : "bg-card/50 border-border/50 hover:border-amber-500/30",
                    plan.popular && "ring-2 ring-amber-500/30",
                  )}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  {plan.popular && (
                    <div className="absolute top-0 right-0 px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-medium rounded-bl-lg">
                      Most Popular
                    </div>
                  )}
                  {plan.badge && (
                    <div className="absolute top-0 right-0 px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-medium rounded-bl-lg">
                      {plan.badge}
                    </div>
                  )}
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-2">{plan.name}</h3>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-3xl font-bold text-amber-400">${plan.price}</span>
                      <span className="text-muted-foreground text-sm">/{plan.period}</span>
                    </div>
                    {plan.billed && <p className="text-xs text-muted-foreground">${plan.billed} billed yearly</p>}
                    {plan.savings && (
                      <Badge className="mt-2 bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                        {plan.savings}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* CTA Button */}
            <Button
              size="lg"
              className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90 rounded-xl px-8 h-14 text-lg"
            >
              <Zap className="h-5 w-5" />
              Donate Now
              <ArrowRight className="h-5 w-5" />
            </Button>

            <p className="text-xs text-muted-foreground mt-4">Every bit helps - Cancel anytime - Secure payment</p>
          </div>
        </section>
      </main>
    </div>
  )
}
