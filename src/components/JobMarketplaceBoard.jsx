import { formatBudgetLabel } from "../utils/currency";

export function JobMarketplaceBoard({
  jobs,
  onSelectJob,
  mode = "browse",
  showAction = true,
  actionLabel,
  variant = "default"
}) {
  return (
    <section className="content-card">
      <div className="board-list">
        {jobs.length === 0 && <p className="helper-copy wide-copy">No jobs available yet.</p>}
        {jobs.map((job) => (
          <article
            key={job.jobId}
            className={
              [
                "listing-card",
                onSelectJob && !showAction ? "listing-card-clickable" : "",
                variant === "proposal-review" ? "listing-card-proposal-review" : ""
              ]
                .filter(Boolean)
                .join(" ")
            }
            onClick={onSelectJob && !showAction ? () => onSelectJob(job) : undefined}
            role={onSelectJob && !showAction ? "button" : undefined}
            tabIndex={onSelectJob && !showAction ? 0 : undefined}
            onKeyDown={
              onSelectJob && !showAction
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectJob(job);
                    }
                  }
                : undefined
            }
          >
            <div className="listing-head">
              <div>
                <h4>{job.title}</h4>
                {variant === "proposal-review" ? (
                  <p className="listing-caption">
                    View {job.proposals?.length || 0} proposal{(job.proposals?.length || 0) === 1 ? "" : "s"} for this job
                  </p>
                ) : (
                  <p>{job.description}</p>
                )}
              </div>
              <span className="state-badge">{job.status || "Open"}</span>
            </div>
            <div className="listing-meta">
              {variant === "proposal-review" ? (
                <>
                  <span>Job ID: {job.jobId}</span>
                  <span>{formatBudgetLabel(job)} budget</span>
                  <span>{job.proposals?.length || 0} proposals</span>
                </>
              ) : (
                <>
                  <span>Deadline: {job.deadline || "Not set"}</span>
                  <span>Budget: {formatBudgetLabel(job)}</span>
                  <span>Proposals: {job.proposals?.length || 0}</span>
                </>
              )}
            </div>
            {showAction && onSelectJob && (
              <div className="listing-action-row">
                <button className="secondary-button" type="button" onClick={() => onSelectJob(job)}>
                  {actionLabel ||
                    (variant === "proposal-review"
                      ? "View Proposals"
                      : mode === "client"
                        ? "Manage Listing"
                        : "Open Job")}
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
