"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { TopRow } from "@/lib/data";

type TimelinePoint = {
  time: string;
  pageviews: number;
  events: number;
};

export function TimelineChart({ data }: { data: TimelinePoint[] }) {
  return (
    <div className="chart-frame">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ left: 0, right: 12, top: 18, bottom: 0 }}>
          <defs>
            <linearGradient id="pageviews" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.42} />
              <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fill: "#9ca3af", fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "#9ca3af", fontSize: 12 }} width={34} />
          <Tooltip contentStyle={{ background: "#111318", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }} />
          <Area type="monotone" dataKey="pageviews" stroke="#c4b5fd" fill="url(#pageviews)" strokeWidth={2} />
          <Area type="monotone" dataKey="events" stroke="#fb923c" fill="transparent" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TopBarChart({ data }: { data: TopRow[] }) {
  if (data.length === 0) {
    return <p className="empty-state">No data yet.</p>;
  }

  return (
    <div className="chart-frame compact">
      <ResponsiveContainer width="100%" height={190}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 10, top: 8, bottom: 8 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
          <XAxis type="number" hide />
          <YAxis
            dataKey="label"
            type="category"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#a1a1aa", fontSize: 12 }}
            width={104}
          />
          <Tooltip contentStyle={{ background: "#111318", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#a78bfa" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ServerChart({ data }: { data: Array<{ time: string; cpu: number; memory: number; disk: number; load: number }> }) {
  return (
    <div className="chart-frame">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ left: 0, right: 12, top: 18, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fill: "#9ca3af", fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "#9ca3af", fontSize: 12 }} width={34} />
          <Tooltip contentStyle={{ background: "#111318", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }} />
          <Area type="monotone" dataKey="cpu" stroke="#f97316" fill="rgba(249,115,22,0.12)" strokeWidth={2} />
          <Area type="monotone" dataKey="memory" stroke="#a78bfa" fill="rgba(167,139,250,0.16)" strokeWidth={2} />
          <Area type="monotone" dataKey="disk" stroke="#22c55e" fill="rgba(34,197,94,0.1)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HttpStatusChart({ data }: { data: Array<{ time: string; "2xx": number; "3xx": number; "4xx": number; "5xx": number }> }) {
  return <div className="chart-frame"><ResponsiveContainer width="100%" height={260}><AreaChart data={data} margin={{ left: 0, right: 12, top: 18, bottom: 0 }}>
    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
    <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fill: "#9ca3af", fontSize: 12 }} />
    <YAxis tickLine={false} axisLine={false} tick={{ fill: "#9ca3af", fontSize: 12 }} width={42} />
    <Tooltip contentStyle={{ background: "#111318", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }} />
    <Area type="monotone" dataKey="2xx" stackId="http" stroke="#34d399" fill="rgba(52,211,153,.20)" />
    <Area type="monotone" dataKey="3xx" stackId="http" stroke="#a78bfa" fill="rgba(167,139,250,.18)" />
    <Area type="monotone" dataKey="4xx" stackId="http" stroke="#fb923c" fill="rgba(251,146,60,.20)" />
    <Area type="monotone" dataKey="5xx" stackId="http" stroke="#fb7185" fill="rgba(251,113,133,.24)" />
  </AreaChart></ResponsiveContainer></div>;
}
