"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Option = { value: string; label: string }

type SiteSelectProps = {
  value: string
  onValueChange: (value: string) => void
  options: Option[]
  ariaLabel: string
  id?: string
  disabled?: boolean
  className?: string
}

export function SiteSelect({ value, onValueChange, options, ariaLabel, id, disabled, className = "" }: SiteSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} aria-label={ariaLabel} className={`hk-site-select focus:ring-0 ${className}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="hk-site-select-content">
        {options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}
