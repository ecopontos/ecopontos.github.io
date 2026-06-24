"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BarData {
  label: string;
  value: number;
  color?: string;
}

interface SimpleBarChartProps {
  title: string;
  data: BarData[];
  maxValue?: number;
}

export function SimpleBarChart({ title, data, maxValue }: SimpleBarChartProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((item) => {
          const pct = Math.round((item.value / max) * 100);
          return (
            <div key={item.label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium">{item.value}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    item.color || "bg-primary"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
