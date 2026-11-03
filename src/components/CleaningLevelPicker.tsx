import { Button } from "@/components/ui/button";
import { CLEANING_LEVELS, CLEANING_LEVEL_FEES, type CleaningLevel } from "@/lib/pricing";

export function CleaningLevelPicker({ value, onChange }: { value: CleaningLevel; onChange: (value: CleaningLevel) => void }) {
  return <fieldset className="min-w-0"><legend className="mb-2 text-sm font-semibold text-foreground">Cleaning level</legend>
    <div className="grid grid-cols-3 gap-2">{CLEANING_LEVELS.map(level => <Button type="button" key={level} aria-pressed={value === level} variant={value === level ? "default" : "outline"} onClick={() => onChange(level)} className="h-auto min-w-0 flex-col gap-1 whitespace-normal px-1 py-3"><span>{level}</span><span className="text-xs">{CLEANING_LEVEL_FEES[level] ? `+$${CLEANING_LEVEL_FEES[level]}` : "Base price"}</span></Button>)}</div>
  </fieldset>;
}