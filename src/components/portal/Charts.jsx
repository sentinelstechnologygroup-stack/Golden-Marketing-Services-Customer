import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell } from "recharts";

const TOOLTIP_STYLE = {
  background: "var(--shell)",
  border: "1px solid var(--shell-line)",
  borderRadius: 8,
  color: "#fff",
  fontSize: 12,
  padding: "6px 10px",
};

export function ConversationsAreaChart({ data }) {
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
          <CartesianGrid stroke="#DED6C7" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#7A838C" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#7A838C" }} axisLine={false} tickLine={false} width={36} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#9FB5B3" }} />
          <Area type="monotone" dataKey="conversations" name="Conversations" stroke="#14857F" strokeWidth={2} fill="url(#convGrad)" />
          <Area type="monotone" dataKey="qualified" name="Qualified" stroke="#C9A24B" strokeWidth={2} fill="url(#qualGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SourceBarChart({ data }) {
  return (
    <div className="w-full h-[220px]" role="img" aria-label="Lead source distribution">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="#DED6C7" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#7A838C" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#5D6670" }} axisLine={false} tickLine={false} width={104} />
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
          <CartesianGrid stroke="#DED6C7" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#7A838C" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#7A838C" }} axisLine={false} tickLine={false} width={36} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#9FB5B3" }} />
          <Area type="monotone" dataKey="leads" name="Leads" stroke="#0B2A2E" strokeWidth={2} fill="url(#trendGrad)" />
          <Area type="monotone" dataKey="qualified" name="Qualified" stroke="#C9A24B" strokeWidth={2} fill="transparent" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}