import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ALL_WEEKS } from '@/lib/types';
import { getWeekStatus } from '@/lib/utils-fantasy';
import { WEEK_LABELS } from '@/lib/season-config';

interface WeekNavigationProps {
  currentWeek: number;
  onWeekChange: (week: number) => void;
}

export function WeekNavigation({ currentWeek, onWeekChange }: WeekNavigationProps) {
  const weeks = ALL_WEEKS;
  
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
  
  return (
    <div className="w-full">
      <div className="md:hidden">
        <Select value={currentWeek.toString()} onValueChange={(value) => onWeekChange(parseInt(value, 10))}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select week" />
          </SelectTrigger>
          <SelectContent>
            {weeks.map((week) => (
              <SelectItem key={week} value={week.toString()}>
                Week {week}: {getWeekTooltip(week)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="hidden md:block">
        <Tabs value={currentWeek.toString()} onValueChange={(value) => onWeekChange(parseInt(value, 10))}>
          <TabsList className="grid w-full grid-cols-6 lg:grid-cols-9 xl:grid-cols-18 gap-1">
            {weeks.map((week) => {
              const status = getWeekStatus(week);
              return (
                <TabsTrigger
                  key={week}
                  value={week.toString()}
                  className="text-xs px-1 py-2 relative"
                  title={getWeekTooltip(week)}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span>{getWeekLabel(week)}</span>
                    {status === 'locked' && <div className="w-1 h-1 bg-red-500 rounded-full"></div>}
                    {status === 'current' && <div className="w-1 h-1 bg-green-500 rounded-full"></div>}
                  </div>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
