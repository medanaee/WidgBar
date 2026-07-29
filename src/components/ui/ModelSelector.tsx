import * as React from "react"
import { ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ModelSelectorProps {
  models: string[]
  value: string
  onValueChange: (value: string) => void
  isLoading?: boolean
  className?: string
  placeholder?: string
}

export function ModelSelector({
  models,
  value,
  onValueChange,
  isLoading,
  className,
  placeholder = "Select model..."
}: ModelSelectorProps) {
  const [open, setOpen] = React.useState(false)

  // Determine display text for selected model. 
  // We use the full ID so they can see exact model versions.
  const getDisplayName = (m: string) => {
    return m;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between font-normal", className)}
        >
          <span className="truncate">{value ? getDisplayName(value) : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 border-0 rounded-xl" align="start">
        <Command>
          <CommandInput placeholder="Search model..." className="text-xs border-none focus:ring-0" />
          <CommandList className="max-h-[300px] overflow-y-auto custom-scrollbar">
            <CommandEmpty className="text-xs p-4 text-center text-zinc-500">
              {isLoading ? "Loading models..." : "No model found."}
            </CommandEmpty>
            <CommandGroup>
              {models.map((model) => (
                <CommandItem
                  key={model}
                  value={model}
                  onSelect={(currentValue) => {
                    // command item sometimes returns lowercased value, so we find the exact original match
                    const exactMatch = models.find(m => m.toLowerCase() === currentValue.toLowerCase()) || model;
                    onValueChange(exactMatch)
                    setOpen(false)
                  }}
                  className={cn(
                    "text-xs truncate cursor-pointer py-1.5",
                    value === model ? "bg-primary/15 text-primary data-selected:bg-primary/20 data-selected:text-primary font-medium" : ""
                  )}
                >
                  {model}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
