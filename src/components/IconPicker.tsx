import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { JOINT_ICON_OPTIONS, buildJointSVG } from './MapView';
import type { JointType } from '../types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useState } from 'react';

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  jointType: JointType;
}

// Re-export for MapView access
export { JOINT_ICON_OPTIONS };

export default function IconPicker({ value, onChange, jointType }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const selectedOption = JOINT_ICON_OPTIONS.find((opt) => opt.key === value) || JOINT_ICON_OPTIONS[0];
  const { svg: selectedSvg } = buildJointSVG(jointType, selectedOption.key);

  return (
    <div className="grid gap-1.5">
      <Label>Map Icon</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger type="button" className="flex items-center gap-2 p-2 rounded-lg border-2 border-border bg-card hover:bg-muted w-fit cursor-pointer transition-colors" title={selectedOption.label}>
            <div
              className="size-7 flex items-center justify-center shrink-0"
              dangerouslySetInnerHTML={{ __html: selectedSvg }}
              style={{ transform: 'scale(0.85)' }}
            />
            <span className="text-sm font-medium pr-2">
              {selectedOption.label}
            </span>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-2" align="start">
          <div className="grid grid-cols-4 gap-1.5">
            {JOINT_ICON_OPTIONS.map((opt) => {
              const { svg } = buildJointSVG(jointType, opt.key);
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    onChange(opt.key);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all cursor-pointer',
                    value === opt.key
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-transparent bg-transparent hover:bg-muted',
                  )}
                  title={opt.label}
                >
                  <div
                    className="size-7 flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: svg }}
                    style={{ transform: 'scale(0.85)' }}
                  />
                  <span className="text-[9px] leading-tight text-muted-foreground font-medium truncate w-full text-center">
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
