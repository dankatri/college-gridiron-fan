import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TOTAL_WEEKS } from '@/lib/types';

interface WeekNavigationProps {
  currentWeek: number;
  onWeekChange: (week: number) => void;
}

export function WeekNavigation({ currentWeek, onWeekChange }: WeekNavigationProps) {
  const weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);
  
  return (
    <div className="w-full">
      <Tabs value={currentWeek.toString()} onValueChange={(value) => onWeekChange(parseInt(value))}>
        <TabsList className="grid w-full grid-cols-5 lg:grid-cols-8 xl:grid-cols-15">
          {weeks.map(week => (
            <TabsTrigger 
              key={week} 
              value={week.toString()}
              className="text-xs px-2"
            >
              W{week}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}