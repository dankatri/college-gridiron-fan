import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TOTAL_WEEKS } from '@/lib/types';
import { getWeekStatus } from '@/lib/utils-fantasy';
import { Badge } from '@/components/ui/badge';

interface WeekNavigationProps {
  currentWeek: number;
  onWeekChange: (week: number) => void;
}

export function WeekNavigation({ currentWeek, onWeekChange }: WeekNavigationProps) {
  const weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);
  
  const getWeekLabel = (week: number): string => {
    if (week <= 14) return `W${week}`;
    if (week === 15) return 'CCG'; // Conference Championships
    if (week === 16) return 'Bowl'; // Bowl Games
    if (week === 17) return 'Bowl+'; // More Bowl Games  
    if (week === 18) return 'CFP'; // College Football Playoff
    return `W${week}`;
  };
  
  const getWeekTooltip = (week: number): string => {
    if (week <= 14) return `Week ${week}`;
    if (week === 15) return 'Conference Championships';
    if (week === 16) return 'Bowl Games (Dec 8-13)';
    if (week === 17) return 'Bowl Games (Dec 13-Jan 20)';
    if (week === 18) return 'College Football Playoff';
    return `Week ${week}`;
  };
  
  return (
    <div className="w-full">
      <Tabs value={currentWeek.toString()} onValueChange={(value) => onWeekChange(parseInt(value))}>
        <TabsList className="grid w-full grid-cols-6 lg:grid-cols-9 xl:grid-cols-18 gap-1">
          {weeks.map(week => {
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
                  {status === 'locked' && (
                    <div className="w-1 h-1 bg-red-500 rounded-full"></div>
                  )}
                  {status === 'current' && (
                    <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                  )}
                </div>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
    </div>
  );
}