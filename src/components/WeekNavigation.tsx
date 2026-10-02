import { CaretDown } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMinuteClock } from '@/hooks/use-minute-clock';
import { getWeekStatus } from '@/lib/utils-fantasy';
import { WEEK_LABELS } from '@/lib/season-config';
import { groupNavigationWeeks } from '@/lib/week-navigation';

interface WeekNavigationProps {
  currentWeek: number;
  onWeekChange: (week: number) => void;
  gameFinals: ReadonlySet<number>;
}

export function WeekNavigation({ currentWeek, onWeekChange, gameFinals }: WeekNavigationProps) {
  const now = useMinuteClock();
  const { completed, regular, postseason } = groupNavigationWeeks(new Date(now), gameFinals);
  const groups = [
    { label: 'Completed weeks', weeks: completed },
    { label: 'Regular season', weeks: regular },
    { label: 'Post season', weeks: postseason },
  ];
  const selectWeek = (value: string) => onWeekChange(Number(value));
  
  const getWeekLabel = (week: number): string => {
    if (week <= 12) return `W${week}`;
    const label = WEEK_LABELS[week];
    if (!label) return `W${week}`;
    if (label === 'Rivalry Week') return 'Rival';
    if (label === 'Championship Week') return 'CCG';
    if (label === 'CFP First Round') return 'CFP R1';
    if (label === 'CFP Quarterfinals') return 'CFP QF';
    if (label === 'CFP Semifinals') return 'CFP SF';
    if (label === 'National Championship') return 'NCG';
    return label;
  };
  
  const getWeekTooltip = (week: number): string => {
    return WEEK_LABELS[week] || `Week ${week}`;
  };

  const renderWeekMenu = (label: string, weeks: number[], align: 'start' | 'end') => {
    const selected = weeks.includes(currentWeek);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={selected ? 'secondary' : 'outline'}
            className="h-11 shrink-0 gap-2 px-3 text-xs"
            disabled={weeks.length === 0}
          >
            {label}
            {selected && <span className="rounded bg-background/70 px-1.5 py-0.5 font-semibold">{getWeekLabel(currentWeek)}</span>}
            <CaretDown size={14} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-64">
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={currentWeek.toString()} onValueChange={selectWeek}>
            {weeks.map(week => (
              <DropdownMenuRadioItem key={week} value={week.toString()}>
                {getWeekTooltip(week)}
                {getWeekStatus(week, new Date(now), gameFinals) === 'current' && <span className="ml-auto size-1.5 rounded-full bg-green-500" aria-hidden="true" />}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };
  
  return (
    <nav className="w-full min-w-0" aria-label="Game weeks">
      <div className="md:hidden">
        <Select value={currentWeek.toString()} onValueChange={selectWeek}>
          <SelectTrigger className="w-full" aria-label="Select game week">
            <SelectValue placeholder="Select week" />
          </SelectTrigger>
          <SelectContent>
            {groups.filter(group => group.weeks.length > 0).map(group => (
              <SelectGroup key={group.label}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.weeks.map(week => (
                  <SelectItem key={week} value={week.toString()}>
                    Week {week}: {getWeekTooltip(week)}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="hidden min-w-0 items-center gap-2 md:flex">
        {renderWeekMenu('Completed weeks', completed, 'start')}
        {regular.length > 0 ? (
          <Tabs className="min-w-0 flex-1" value={currentWeek.toString()} onValueChange={selectWeek}>
            <TabsList aria-label="Regular-season weeks" className="h-auto min-h-11 w-full justify-start gap-1 overflow-x-auto p-1">
              {regular.map((week) => {
                const status = getWeekStatus(week, new Date(now), gameFinals);
                return (
                  <TabsTrigger
                    key={week}
                    value={week.toString()}
                    className="relative h-9 min-w-9 shrink-0 px-2 py-1 text-xs"
                    title={getWeekTooltip(week)}
                    aria-description={status === 'current' ? 'Current game week' : undefined}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span>{getWeekLabel(week)}</span>
                      {status === 'current' && <span className="size-1 rounded-full bg-green-500" aria-hidden="true" />}
                    </div>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        ) : <div className="flex-1" />}
        {renderWeekMenu('Post season', postseason, 'end')}
      </div>
    </nav>
  );
}
