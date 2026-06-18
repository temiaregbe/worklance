import { useMemo, useState } from "react";

export function ChatPanel({
  jobs,
  selectedJob,
  onSelectJob,
  currentUser,
  account,
  messages,
  onSendMessage,
  isBusy,
  mode = "client"
}) {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");

  const conversationJobs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return jobs.filter((job) => {
      const counterpartName =
        mode === "client"
          ? job.selectedFreelancerUsername || job.selectedFreelancerName || job.selectedFreelancer || ""
          : job.clientUsername || job.clientName || job.clientWallet || "";

      const haystack = [job.title, job.description, counterpartName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return query ? haystack.includes(query) : true;
    });
  }, [jobs, mode, search]);

  const thread = useMemo(
    () =>
      messages.filter((message) => String(message.jobId) === String(selectedJob?.jobId || "")),
    [messages, selectedJob]
  );

  const selectedCounterpart =
    mode === "client"
      ? selectedJob?.selectedFreelancerUsername || selectedJob?.selectedFreelancerName || shortAddress(selectedJob?.selectedFreelancer)
      : selectedJob?.clientUsername || selectedJob?.clientName || shortAddress(selectedJob?.clientWallet);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selectedJob || !draft.trim()) {
      return;
    }

    await onSendMessage(selectedJob.jobId, {
      senderWallet: account,
      senderName: currentUser?.username || currentUser?.name || "User",
      senderUsername: currentUser?.username || "",
      senderRole: currentUser?.role || "member",
      body: draft.trim()
    });
    setDraft("");
  }

  return (
    <section className="content-card clean-panel chat-app-shell">
      <aside className="chat-sidebar">
        <div className="chat-sidebar-head">
          <div>
            <p className="section-kicker">Connections</p>
            <h3>{mode === "client" ? "Freelancers" : "Clients"}</h3>
          </div>
        </div>

        <label className="chat-search-wrap">
          <input
            className="chat-search-input"
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${mode === "client" ? "freelancers" : "clients"} or jobs...`}
          />
        </label>

        <div className="chat-conversation-list">
          {conversationJobs.length === 0 ? (
            <p className="helper-copy wide-copy">
              No conversations are available yet for this workspace.
            </p>
          ) : (
            conversationJobs.map((job) => {
              const lastMessage = [...messages]
                .filter((item) => String(item.jobId) === String(job.jobId))
                .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0];

              const counterpart =
                mode === "client"
                  ? job.selectedFreelancerUsername || job.selectedFreelancerName || shortAddress(job.selectedFreelancer)
                  : job.clientUsername || job.clientName || shortAddress(job.clientWallet);

              return (
                <button
                  key={job.jobId}
                  type="button"
                  className={
                    String(selectedJob?.jobId || "") === String(job.jobId)
                      ? "chat-conversation-card active"
                      : "chat-conversation-card"
                  }
                  onClick={() => onSelectJob(job)}
                >
                  <span className="chat-avatar">{initials(counterpart || job.title)}</span>
                  <span className="chat-conversation-copy">
                    <strong>{counterpart || "Open conversation"}</strong>
                    <span>{job.title}</span>
                    <small>{lastMessage?.body || "No messages yet"}</small>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="chat-stage">
        {!selectedJob ? (
          <div className="chat-empty-state">
            <p className="section-kicker">Messages</p>
            <h3>Select a conversation</h3>
            <p className="helper-copy wide-copy">
              Choose a client or freelancer from the left to open the full conversation thread.
            </p>
          </div>
        ) : (
          <>
            <header className="chat-thread-head">
              <div className="chat-thread-persona">
                <span className="chat-avatar large">{initials(selectedCounterpart || selectedJob.title)}</span>
                <div>
                  <strong>{selectedCounterpart || "Conversation"}</strong>
                  <span>{selectedJob.title}</span>
                </div>
              </div>
              <div className="chat-thread-meta">
                <span>Job #{selectedJob.jobId}</span>
                <span>{selectedJob.status || "Open"}</span>
              </div>
            </header>

            <div className="chat-thread-board">
              {thread.length === 0 ? (
                <div className="chat-empty-thread">
                  <p className="helper-copy wide-copy">
                    No messages yet for this job. Start the conversation below.
                  </p>
                </div>
              ) : (
                thread.map((message) => {
                  const ownMessage =
                    message.senderWallet?.toLowerCase() === account?.toLowerCase();

                  return (
                    <article
                      key={message.id}
                      className={ownMessage ? "chat-bubble own" : "chat-bubble"}
                    >
                      <div className="chat-bubble-meta">
                        <strong>{ownMessage ? "You" : message.senderUsername || message.senderName}</strong>
                        <span>{formatChatTime(message.createdAt)}</span>
                      </div>
                      <p>{message.body}</p>
                    </article>
                  );
                })
              )}
            </div>

            <form className="chat-compose-bar" onSubmit={handleSubmit}>
              <textarea
                rows="2"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Type a message..."
                required
              />
              <button className="primary-button" type="submit" disabled={isBusy || !currentUser}>
                Send
              </button>
            </form>
          </>
        )}
      </section>
    </section>
  );
}

function shortAddress(address) {
  if (!address) {
    return "";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function initials(value) {
  const words = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) {
    return "C";
  }

  return words.map((word) => word[0]?.toUpperCase() || "").join("");
}

function formatChatTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
