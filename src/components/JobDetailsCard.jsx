export function JobDetailsCard({
  job,
  jobStates,
  onFund,
  onApprove,
  onReject,
  onCancel,
  isBusy,
  mode = "full",
  emptyMessage = "Load a job to see its details."
}) {
  if (!job) {
    return (
      <section className="content-card job-details-card empty-state-card">
        <p className="section-kicker">Job Overview</p>
        <h3>No job loaded yet</h3>
        <p className="helper-copy wide-copy">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section className="content-card job-details-card">
      <div className="card-heading-row">
        <div>
          <p className="section-kicker">Job Overview</p>
          <h3>{job.jobId}</h3>
        </div>
        <span className="state-badge">{jobStates[job.state] || "Unknown"}</span>
      </div>

      <p className="job-description">{job.description}</p>

      <div className="detail-grid">
        <article>
          <span>Escrow Value</span>
          <strong>{job.paymentEth} ETH</strong>
        </article>
        <article>
          <span>Client</span>
          <strong>{job.client}</strong>
        </article>
        <article>
          <span>Freelancer</span>
          <strong>{job.freelancer}</strong>
        </article>
        <article>
          <span>Submission</span>
          <strong>{job.workSubmission || "No submission yet"}</strong>
        </article>
      </div>

      {(job.deliveryLinks?.length || job.files?.length) ? (
        <div className="job-assets-shell">
          {job.deliveryLinks?.length ? (
            <section className="job-assets-block">
              <span className="section-kicker">Delivery Links</span>
              <div className="job-asset-list">
                {job.deliveryLinks.map((link) => (
                  <a
                    key={link}
                    className="job-asset-link"
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link}
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          {job.files?.length ? (
            <section className="job-assets-block">
              <span className="section-kicker">Attached Files</span>
              <div className="job-asset-list">
                {job.files.map((file) => {
                  const href = file.gatewayUrl || "";

                  return href ? (
                    <a
                      key={file.id || file.fileName}
                      className="job-asset-link"
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {file.fileName || file.label || "Open file"}
                    </a>
                  ) : (
                    <span key={file.id || file.fileName} className="job-asset-chip">
                      {file.fileName || file.label || "Uploaded file"}
                    </span>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {mode === "full" && (onFund || onApprove || onReject || onCancel) && (
        <div className="action-row">
          {onFund && (
            <button
              className="secondary-button"
              onClick={() => onFund(job.jobId, job.paymentAmount)}
              disabled={isBusy}
            >
              Fund Escrow
            </button>
          )}
          {onApprove && (
            <button className="secondary-button" onClick={() => onApprove(job.jobId)} disabled={isBusy}>
              Approve Work
            </button>
          )}
          {onReject && (
            <button className="secondary-button" onClick={() => onReject(job.jobId)} disabled={isBusy}>
              Reject Work
            </button>
          )}
          {onCancel && (
            <button className="danger-button" onClick={() => onCancel(job.jobId)} disabled={isBusy}>
              Cancel Job
            </button>
          )}
        </div>
      )}
    </section>
  );
}
