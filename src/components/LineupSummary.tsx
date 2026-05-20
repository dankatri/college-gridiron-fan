import { LineupSlot } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { calculateProjectedPoints } from '@/lib/utils-fantasy';
import { TrendUp as TrendingUp, TrendDown as TrendingDown } from '@phosphor-icons/react';

interface LineupSummaryProps {
  lineup: LineupSlot[];
  actualPoints?: number;
}

export function LineupSummary({ lineup, actualPoints }: LineupSummaryProps) {
  const projectedPoints = calculateProjectedPoints(lineup);
  const filledSlots = lineup.filter(slot => slot.player).length;
  const totalSlots = lineup.length;
  
  const positionCounts = lineup.reduce((acc, slot) => {
    if (slot.player) {
      acc[slot.position] = (acc[slot.position] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const pointsDifference = actualPoints ? actualPoints - projectedPoints : 0;
  const hasActualPoints = actualPoints !== undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Lineup Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Points Section */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Projected Points</span>
            <span className="text-xl font-bold">
              {projectedPoints.toFixed(1)}
            </span>
          </div>
          
          {hasActualPoints && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Actual Points</span>
                <span className="text-2xl font-bold text-accent">
                  {actualPoints.toFixed(1)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">vs. Projection</span>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={pointsDifference >= 0 ? "default" : "destructive"}
                    className="flex items-center gap-1"
                  >
                    {pointsDifference >= 0 ? (
                      <TrendingUp size={12} />
                    ) : (
                      <TrendingDown size={12} />
                    )}
                    {pointsDifference >= 0 ? '+' : ''}{pointsDifference.toFixed(1)}
                  </Badge>
                </div>
              </div>
            </>
          )}
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Lineup Progress</span>
          <span className="text-sm font-medium">
            {filledSlots}/{totalSlots} players
          </span>
        </div>
        
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Positions Filled</h4>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center">
              <div className="font-medium">QB</div>
              <div className="text-muted-foreground">{positionCounts.QB || 0}/2</div>
            </div>
            <div className="text-center">
              <div className="font-medium">RB</div>
              <div className="text-muted-foreground">{positionCounts.RB || 0}/2</div>
            </div>
            <div className="text-center">
              <div className="font-medium">WR</div>
              <div className="text-muted-foreground">{positionCounts.WR || 0}/2</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}