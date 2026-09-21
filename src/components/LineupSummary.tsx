import { LineupSlot } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LineupSummaryProps {
  lineup: LineupSlot[];
  actualPoints?: number;
}

export function LineupSummary({ lineup, actualPoints }: LineupSummaryProps) {
  const filledSlots = lineup.filter(slot => slot.player).length;
  const totalSlots = lineup.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Lineup Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {actualPoints !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Actual Points</span>
            <span className="text-2xl font-bold text-accent">
              {actualPoints.toFixed(1)}
            </span>
          </div>
        )}
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Lineup Progress</span>
          <span className="text-sm font-medium">
            {filledSlots}/{totalSlots} players
          </span>
        </div>
        
      </CardContent>
    </Card>
  );
}