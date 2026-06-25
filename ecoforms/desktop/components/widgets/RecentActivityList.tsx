"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

interface ActivityItem {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  type?: "task" | "demand" | "suite" | "system";
}

interface RecentActivityListProps {
  title: string;
  items: ActivityItem[];
}

const typeColors: Record<string, string> = {
  task: "bg-blue-500",
  demand: "bg-amber-500",
  suite: "bg-emerald-500",
  system: "bg-gray-500",
};

const typeLabels: Record<string, string> = {
  task: "Tarefa",
  demand: "Demanda",
  suite: "Suite",
  system: "Sistema",
};

export function RecentActivityList({ title, items }: RecentActivityListProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma atividade recente.</p>
        ) : (
          items.slice(0, 6).map((item) => (
            <div key={item.id} className="flex items-start gap-3 text-sm">
              <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${typeColors[item.type || "system"]}`} />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{item.title}</p>
                {item.description && (
                  <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  {item.type && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {typeLabels[item.type]}
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {item.timestamp}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
