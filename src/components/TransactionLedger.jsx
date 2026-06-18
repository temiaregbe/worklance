export function TransactionLedger({ records }) {
  return (
    <section className="content-card">
      <div className="card-heading-row">
        <div>
          <p className="section-kicker">Transaction Record Management</p>
          <h3>Activity ledger</h3>
        </div>
      </div>
      <div className="board-list">
        {records.length === 0 && <p className="helper-copy wide-copy">No transaction records yet.</p>}
        {records.map((record) => (
          <article key={record.id} className="listing-card">
            <div className="listing-head">
              <div>
                <h4>{record.type}</h4>
                <p>{record.description}</p>
              </div>
              <span className="state-badge">{record.createdAt.slice(0, 10)}</span>
            </div>
            <div className="listing-meta">
              <span>Job: {record.jobId || "N/A"}</span>
              <span>Actor: {record.actor || "System"}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
