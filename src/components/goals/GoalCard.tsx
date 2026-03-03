import { Goal } from "@/hooks/useGoals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Pencil, Trash2, CalendarDays } from "lucide-react";
import { differenceInDays, format, parseISO } from "date-fns";

interface GoalCardProps {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onDelete: (id: string) => void;
}

export default function GoalCard({ goal, onEdit, onDelete }: GoalCardProps) {
  const progress = goal.targetValue > 0 ? Math.min((goal.currentValue / goal.targetValue) * 100, 100) : 0;
  const daysLeft = differenceInDays(parseISO(goal.endDate), new Date());
  const isOverdue = daysLeft < 0;
  const isComplete = progress >= 100;

  const formatValue = (v: number) => {
    if (goal.unit === "$") return `$${v >= 1000 ? (v / 1000).toFixed(1) + "K" : v}`;
    if (goal.unit === "%") return `${v}%`;
    return `${v}`;
  };

  return (
    <div className="stat-card space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">{goal.name}</h3>
          <p className="text-xs text-muted-foreground line-clamp-1">{goal.description}</p>
        </div>
        <Badge
          variant="outline"
          className="text-[10px] shrink-0 border-border text-muted-foreground"
        >
          {goal.category}
        </Badge>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-mono">
          <span className="text-muted-foreground">
            {formatValue(goal.currentValue)} / {formatValue(goal.targetValue)}
          </span>
          <span className={isComplete ? "text-primary glow-green" : "text-foreground"}>
            {progress.toFixed(0)}%
          </span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
          <CalendarDays className="h-3 w-3" />
          <span>{format(parseISO(goal.startDate), "MMM d")} — {format(parseISO(goal.endDate), "MMM d")}</span>
          {!isComplete && (
            <span className={isOverdue ? "text-destructive" : "text-primary"}>
              · {isOverdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(goal)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDelete(goal.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
