import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell, Legend } from "recharts";

function EmptyChartFrame({ label, series }) {
  return <div className="w-full" role="img" aria-label={`${label}. No activity recorded yet.`}>
    <div className="relative h-[220px]">
      <svg viewBox="0 0 600 220" preserveAspectRatio="none" className="w-full h-full" aria-hidden="true">
        {[30, 70, 110, 150, 190].map((y) => <line key={y} x1="35" y1={y} x2="585" y2={y} stroke="var(--line-2)" />)}
        <path d="M35 20 V190 H585" fill="none" stroke="var(--muted-ink)" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[13px]" style={{ color: "var(--muted-ink)" }}>No activity recorded yet</div>
    </div>
    <div className="flex flex-wrap justify-center gap-4 text-[12px]" style={{ color: "var(--muted-ink)" }}>
      {series.map(([name, color]) => <span key={name} className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: color }} />{name}</span>)}
    </div>
  </div>;
}

const TOOLTIP_STYLE = {
  background: "var(--shell)",
  border: "1px solid var(--shell-line)",
  borderRadius: 8,
  color: "#fff",
  fontSize: 12,
  padding: "6px 10px",
};

export function ConversationsAreaChart({ data }) {
  if (!data?.length) return <EmptyChartFrame label="Conversations and qualified opportunities" series={[["Conversations", "var(--teal)"], ["Qualified", "var(--gold)"]]} />;
  return (
    <div className="w-full h-[220px]" role="img" aria-label="Seven-day conversations and qualified opportunities trend">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="convGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14857F" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#14857F" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="qualGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C9A24B" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#C9A24B" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#EFEAE0" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#5A6B6D" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#5A6B6D" }} axisLine={false} tickLine={false} width={36} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#9FB5B3" }} />
          <Legend />
          <Area type="monotone" dataKey="conversations" name="Conversations" stroke="#14857F" strokeWidth={2} fill="url(#convGrad)" />
          <Area type="monotone" dataKey="qualified" name="Qualified" stroke="#C9A24B" strokeWidth={2} fill="url(#qualGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SourceBarChart({ data }) {
  if (!data?.length) return <EmptyChartFrame label="Lead source distribution" series={[["Inquiries by source", "var(--teal)"]]} />;
  return (
    <div className="w-full h-[220px]" role="img" aria-label="Lead source distribution">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="#EFEAE0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#5A6B6D" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#33474A" }} axisLine={false} tickLine={false} width={104} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#9FB5B3" }} cursor={{ fill: "rgba(20,133,127,0.06)" }} />
          <Bar dataKey="value" name="Leads" radius={[0, 4, 4, 0]} barSize={16}>
            {data.map((_, i) => <Cell key={i} fill={i % 2 ? "#0D6E68" : "#14857F"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendChart({ data }) {
  if (!data?.length) return <EmptyChartFrame label="Lead volume and qualified trend" series={[["Inquiries", "var(--teal)"], ["Qualified", "var(--gold)"]]} />;
  return (
    <div className="w-full h-[240px]" role="img" aria-label="Lead volume and qualified trend">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0B2A2E" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#0B2A2E" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#EFEAE0" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#5A6B6D" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#5A6B6D" }} axisLine={false} tickLine={false} width={36} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#9FB5B3" }} />
          <Area type="monotone" dataKey="leads" name="Leads" stroke="#0B2A2E" strokeWidth={2} fill="url(#trendGrad)" />
          <Area type="monotone" dataKey="qualified" name="Qualified" stroke="#C9A24B" strokeWidth={2} fill="transparent" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
