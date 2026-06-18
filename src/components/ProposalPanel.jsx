import { useState } from "react";
import {
  compareEthAmounts,
  formatBudgetLabel,
  formatProposalBidLabel,
  normalizeEthAmount,
  supportedCurrencies
} from "../utils/currency";

const emptyProposal = {
  coverLetter: "",
  bidAmount: "",
  bidCurrency: "ETH",
  eta: "",
  portfolioMode: "url",
  portfolioUrl: "",
  portfolioFile: null,
  cvFile: null
};

function getDocumentUrl(record, gatewayKey, dataKey) {
  return record?.[gatewayKey] || record?.[dataKey] || "";
}

async function downloadDocument(url, fileName = "worklance-document") {
  if (!url) {
    return;
  }

  if (url.startsWith("data:")) {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Could not fetch document.");
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.rel = "noreferrer";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}

function ProposalDocumentButton({ url, fileName, fallbackLabel }) {
  if (!url && !fileName) {
    return null;
  }

  if (!url) {
    return (
      <span className="proposal-doc-link proposal-doc-link-muted">
        {fileName || fallbackLabel}
      </span>
    );
  }

  return (
    <button
      className="proposal-doc-link"
      type="button"
      onClick={() => downloadDocument(url, fileName || fallbackLabel)}
    >
      Download {fileName || fallbackLabel}
    </button>
  );
}

export function ProposalPanel({
  currentUser,
  selectedJob,
  onSubmitProposal,
  onSelectProposal,
  onCounterOffer,
  onRespondToCounterOffer,
  isBusy,
  mode = "freelancer"
}) {
  const [proposal, setProposal] = useState(emptyProposal);
  const [counterOffer, setCounterOffer] = useState(null);
  const selectedProposalId = selectedJob?.selectedProposalId;
  const selectedFreelancerWallet = selectedJob?.selectedFreelancer;
  const existingFreelancerProposal = (selectedJob?.proposals || []).find(
    (item) =>
      item.freelancerProfileId === currentUser?.profileId ||
      item.freelancerWallet?.toLowerCase() === currentUser?.wallet?.toLowerCase()
  );
  const proposedEthAmount = normalizeEthAmount(proposal.bidAmount, proposal.bidCurrency);
  const bidComparison = compareEthAmounts(proposedEthAmount, selectedJob?.paymentAmountEth);

  function handleSubmit(event) {
    event.preventDefault();
    if (!selectedJob) {
      return;
    }

    if (
      bidComparison !== 0 &&
      selectedJob?.paymentAmountEth &&
      !window.confirm(
        `Your bid is ${bidComparison > 0 ? "higher" : "lower"} than the client budget. Submit this proposal anyway?`
      )
    ) {
      return;
    }

    onSubmitProposal(selectedJob.jobId, proposal);
    setProposal(emptyProposal);
  }

  async function handleCounterOfferSubmit(event) {
    event.preventDefault();
    if (!selectedJob || !counterOffer) {
      return;
    }

    const bidAmountEth = normalizeEthAmount(counterOffer.bidAmountValue, counterOffer.bidCurrency);
    await onCounterOffer?.(selectedJob.jobId, counterOffer.proposalId, {
      counterAmountValue: counterOffer.bidAmountValue,
      counterCurrency: counterOffer.bidCurrency,
      counterAmountEth: bidAmountEth,
      counterOfferNote: counterOffer.note,
      counterOfferedAt: new Date().toISOString(),
      negotiationStatus: "pending"
    });
    setCounterOffer(null);
  }

  return (
    <section className="proposal-panel proposal-panel-review-shell">
      {!selectedJob && <p className="helper-copy wide-copy">Select a job listing to continue.</p>}

      {selectedJob && mode === "freelancer" && (
        <>
        {existingFreelancerProposal?.negotiationStatus === "pending" ? (
          <article className="proposal-counter-alert">
            <div>
              <p className="section-kicker">Counter Offer</p>
              <h4>
                Client offered {existingFreelancerProposal.counterAmountValue}{" "}
                {existingFreelancerProposal.counterCurrency} ({existingFreelancerProposal.counterAmountEth} ETH)
              </h4>
              {existingFreelancerProposal.counterOfferNote ? (
                <p>{existingFreelancerProposal.counterOfferNote}</p>
              ) : null}
            </div>
            <div className="action-row">
              <button
                className="primary-button"
                type="button"
                disabled={isBusy}
                onClick={() =>
                  onRespondToCounterOffer?.(selectedJob.jobId, existingFreelancerProposal.id, "accepted")
                }
              >
                Accept Offer
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={isBusy}
                onClick={() =>
                  onRespondToCounterOffer?.(selectedJob.jobId, existingFreelancerProposal.id, "declined")
                }
              >
                Decline
              </button>
            </div>
          </article>
        ) : null}

        {existingFreelancerProposal ? (
          <article className="proposal-counter-alert proposal-counter-alert-muted">
            <p className="section-kicker">Your Submitted Proposal</p>
            <h4>{formatProposalBidLabel(existingFreelancerProposal)}</h4>
            {existingFreelancerProposal.negotiationStatus === "accepted" ? (
              <p>Counter offer accepted. This is now the agreed contract price.</p>
            ) : existingFreelancerProposal.negotiationStatus === "declined" ? (
              <p>Counter offer declined. The client can send another offer or end bidding.</p>
            ) : null}
          </article>
        ) : null}

        {!existingFreelancerProposal ? (
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="span-2">
            Cover Letter
            <textarea
              rows="4"
              value={proposal.coverLetter}
              onChange={(event) => setProposal({ ...proposal, coverLetter: event.target.value })}
              required
            />
          </label>
          <label>
            Bid Amount
            <input
              type="number"
              min="0"
              step="0.01"
              value={proposal.bidAmount}
              onChange={(event) => setProposal({ ...proposal, bidAmount: event.target.value })}
              required
            />
          </label>
          <label>
            Bid Currency
            <select
              value={proposal.bidCurrency}
              onChange={(event) => setProposal({ ...proposal, bidCurrency: event.target.value })}
            >
              {supportedCurrencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>
          <label>
            ETA
            <input
              type="text"
              value={proposal.eta}
              onChange={(event) => setProposal({ ...proposal, eta: event.target.value })}
              placeholder="7 days"
              required
            />
          </label>
          <label>
            Portfolio Type
            <select
              value={proposal.portfolioMode}
              onChange={(event) =>
                setProposal({
                  ...proposal,
                  portfolioMode: event.target.value,
                  portfolioUrl: "",
                  portfolioFile: null
                })
              }
            >
              <option value="url">Portfolio URL</option>
              <option value="document">Portfolio Document</option>
            </select>
          </label>
          <label>
            {proposal.portfolioMode === "url" ? "Portfolio URL" : "Portfolio Document"}
            {proposal.portfolioMode === "url" ? (
              <input
                type="url"
                value={proposal.portfolioUrl}
                onChange={(event) => setProposal({ ...proposal, portfolioUrl: event.target.value })}
                placeholder="https://your-portfolio-link.com"
              />
            ) : (
              <input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx"
                onChange={(event) =>
                  setProposal({ ...proposal, portfolioFile: event.target.files?.[0] || null })
                }
              />
            )}
          </label>
          <label className="span-2">
            CV Document
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(event) =>
                setProposal({ ...proposal, cvFile: event.target.files?.[0] || null })
              }
            />
          </label>
          <p className="helper-copy wide-copy span-2">
            Approximate on-chain value: {proposedEthAmount} ETH
          </p>
          <div className="span-2">
            <button className="primary-button" type="submit" disabled={isBusy || !currentUser}>
              Submit Proposal
            </button>
          </div>
        </form>
        ) : null}
        </>
      )}

      {selectedJob && mode === "client" && (
        <div className="proposal-review-layout">
          <article className="proposal-review-intro-bar">
            <div className="proposal-review-intro-main">
              <div>
                <p className="section-kicker">Review Queue</p>
                <h4>{selectedJob.title}</h4>
                <p className="proposal-intro-copy">
                  Compare {(selectedJob.proposals || []).length} proposal
                  {(selectedJob.proposals || []).length === 1 ? "" : "s"} submitted for this listing.
                </p>
              </div>
              <span className="proposal-review-status">{selectedJob.status || "Open"}</span>
            </div>
            <div className="proposal-review-stats">
              <article>
                <span>Job ID</span>
                <strong>{selectedJob.jobId}</strong>
              </article>
              <article>
                <span>Budget</span>
                <strong>{formatBudgetLabel(selectedJob)}</strong>
              </article>
              <article>
                <span>Responses</span>
                <strong>{(selectedJob.proposals || []).length}</strong>
              </article>
            </div>
          </article>

          <div className="board-list proposal-review-list">
          {(selectedJob.proposals || []).length === 0 && (
            <p className="helper-copy wide-copy">No proposals submitted yet.</p>
          )}
          {(selectedJob.proposals || []).map((item) => (
            <article key={item.id} className="listing-card proposal-review-card proposal-applicant-card">
              {selectedProposalId === item.id && (
                <span className="proposal-selected-badge">Freelancer selected</span>
              )}
              <div className="listing-head proposal-review-head">
                <div>
                  <p className="section-kicker proposal-applicant-kicker">Applicant</p>
                  <h4>{item.freelancerUsername || item.freelancerName}</h4>
                  <p className="proposal-wallet-copy">{item.freelancerWallet}</p>
                </div>
                <div className="proposal-bid-block">
                  <span>Bid</span>
                  <strong>{formatProposalBidLabel(item)}</strong>
                </div>
              </div>
              <div className="proposal-review-meta proposal-review-meta-grid">
                <span>ETA: {item.eta}</span>
                {item.portfolioUrl ? (
                  <a className="proposal-doc-link" href={item.portfolioUrl} target="_blank" rel="noreferrer">
                    Open Portfolio URL
                  </a>
                ) : null}
                <ProposalDocumentButton
                  url={getDocumentUrl(item, "portfolioGatewayUrl", "portfolioDataUrl")}
                  fileName={item.portfolioFileName}
                  fallbackLabel="Portfolio Document"
                />
                <ProposalDocumentButton
                  url={getDocumentUrl(item, "cvGatewayUrl", "cvDataUrl")}
                  fileName={item.cvFileName}
                  fallbackLabel="Proposal CV"
                />
                <ProposalDocumentButton
                  url={getDocumentUrl(item, "profileCvGatewayUrl", "profileCvDataUrl")}
                  fileName={item.profileCvFileName}
                  fallbackLabel="Profile CV"
                />
              </div>
              {item.counterOfferedAt ? (
                <p className="proposal-counter-note">
                  Counter offer: {item.counterAmountValue} {item.counterCurrency} ({item.counterAmountEth} ETH).{" "}
                  Status: {item.negotiationStatus || "pending"}
                  {item.counterOfferNote ? `: ${item.counterOfferNote}` : ""}
                </p>
              ) : null}
              <p className="proposal-cover-letter">{item.coverLetter}</p>
              {counterOffer?.proposalId === item.id ? (
                <form className="proposal-counter-form" onSubmit={handleCounterOfferSubmit}>
                  <label>
                    Counter Amount
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={counterOffer.bidAmountValue}
                      onChange={(event) =>
                        setCounterOffer({ ...counterOffer, bidAmountValue: event.target.value })
                      }
                      required
                    />
                  </label>
                  <label>
                    Currency
                    <select
                      value={counterOffer.bidCurrency}
                      onChange={(event) =>
                        setCounterOffer({ ...counterOffer, bidCurrency: event.target.value })
                      }
                    >
                      {supportedCurrencies.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="span-2">
                    Note
                    <textarea
                      rows="2"
                      value={counterOffer.note}
                      onChange={(event) => setCounterOffer({ ...counterOffer, note: event.target.value })}
                      placeholder="Optional note for why the offer changed."
                    />
                  </label>
                  <p className="helper-copy wide-copy span-2">
                    Contract amount if selected:{" "}
                    {normalizeEthAmount(counterOffer.bidAmountValue, counterOffer.bidCurrency)} ETH
                  </p>
                  {compareEthAmounts(
                    normalizeEthAmount(counterOffer.bidAmountValue, counterOffer.bidCurrency),
                    item.bidAmountEth
                  ) !== 0 ? (
                    <p className="proposal-warning span-2">
                      This counter offer does not match the freelancer's original bid of {formatProposalBidLabel(item)}.
                      The freelancer must accept it before you can select them.
                    </p>
                  ) : null}
                  <div className="action-row span-2">
                    <button className="primary-button" type="submit" disabled={isBusy}>
                      Save Counter Offer
                    </button>
                    <button className="ghost-button" type="button" onClick={() => setCounterOffer(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}
              <div className="proposal-review-actions">
                {selectedProposalId === item.id ? (
                  <button className="secondary-button" type="button" disabled>
                    Selected
                  </button>
                ) : selectedFreelancerWallet ? (
                  <button className="ghost-button" type="button" disabled>
                    Freelancer already selected
                  </button>
                ) : (
                  <>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() =>
                        setCounterOffer({
                          proposalId: item.id,
                          bidAmountValue: item.bidAmountValue || item.bidAmount || "",
                          bidCurrency: item.bidCurrency || "ETH",
                          note: item.counterOfferNote || ""
                        })
                      }
                    >
                      Counter Offer
                    </button>
                    {item.negotiationStatus === "pending" ? (
                      <button className="ghost-button" type="button" disabled>
                        Waiting for freelancer approval
                      </button>
                    ) : item.negotiationStatus === "declined" ? (
                      <button className="ghost-button" type="button" disabled>
                        Counter declined
                      </button>
                    ) : (
                      <button className="primary-button" type="button" onClick={() => onSelectProposal(selectedJob.jobId, item.id)}>
                        Select Freelancer
                      </button>
                    )}
                  </>
                )}
              </div>
            </article>
          ))}
          </div>
        </div>
      )}
    </section>
  );
}
