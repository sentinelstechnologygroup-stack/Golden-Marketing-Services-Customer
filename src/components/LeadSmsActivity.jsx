export default function LeadSmsActivity({ lead }) {
  const verification = lead.smsVerification;
  const status = verification?.phone && verification.phone !== lead.phone ? 'phone changed — re-verification required' : verification?.status || 'Not started';
  return <section className="rounded-xl border p-4 space-y-3" aria-label="SMS verification and messages">
    <h2 className="font-semibold">SMS verification &amp; messages</h2>
    <p className="text-sm">Mobile verification: <strong>{status}</strong></p>
    {verification?.reason && <p className="text-sm">{verification.reason.replace(/_/g, ' ')}</p>}
    <p className="text-xs">Mobile verification confirms access to this phone. Email verification is separate.</p>
    {lead.smsMessages?.length ? <ol className="space-y-3">{lead.smsMessages.map((message, index) => <li key={index} className="border-t pt-2 text-sm">
      <div className="font-medium">{message.direction} · {message.status.replace(/_/g, ' ')}</div>
      <div className="whitespace-pre-wrap break-words">{message.text}</div>
      <time className="text-xs" dateTime={message.at}>{new Date(message.at).toLocaleString()}</time>
    </li>)}</ol> : <p className="text-sm">No SMS activity recorded for this lead.</p>}
  </section>;
}
