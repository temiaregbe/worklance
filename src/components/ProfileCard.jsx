import { useEffect, useState } from "react";

const emptyProfile = {
  name: "",
  email: "",
  role: "client",
  skills: "",
  workHistory: "",
  bio: "",
  cvFile: null
};

export function ProfileCard({
  title,
  user,
  onSave,
  compact = false,
  editable = false,
  stats,
  onViewJobs,
  onViewActive
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(emptyProfile);
  const [cvStatus, setCvStatus] = useState("");

  const skillsList = user?.skills
    ? user.skills
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean)
    : [];

  const walletPreview = user?.wallet
    ? `${user.wallet.slice(0, 10)}...${user.wallet.slice(-4)}`
    : "Wallet not connected";

  const resolvedStats = {
    jobs: stats?.jobs ?? 0,
    active: stats?.active ?? 0,
    rating: stats?.rating ?? "0.0"
  };

  useEffect(() => {
    setForm({
      name: user?.name || "",
      email: user?.email || "",
      role: user?.role || "client",
      skills: user?.skills || "",
      workHistory: user?.workHistory || "",
      bio: user?.bio || "",
      cvFile: null
    });
    setCvStatus(user?.cvFileName || "");
    setIsEditing(false);
  }, [user]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!onSave) {
      return;
    }
    const success = await onSave(form);
    if (success !== false) {
      setIsEditing(false);
    }
  }

  return (
    <section className={compact ? "content-card profile-card-compact profile-layout-card" : "content-card profile-layout-card"}>
      {user && isEditing ? (
        <form
          id={`${title}-profile-form`}
          className="form-grid"
          onSubmit={handleSubmit}
        >
          <div className="span-2 card-heading-row">
            <div>
              <p className="section-kicker">Profile Management</p>
              <h3>{title}</h3>
            </div>
            <div className="action-row">
              <button className="secondary-button" type="submit" form={`${title}-profile-form`}>
                Save Changes
              </button>
              <button className="ghost-button" type="button" onClick={() => setIsEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
          <label>
            Full Name
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
            />
          </label>
          <label>
            Role
            <select
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value })}
            >
              <option value="client">Client</option>
              <option value="freelancer">Freelancer</option>
            </select>
          </label>
          <label>
            Skills
            <input
              type="text"
              value={form.skills}
              onChange={(event) => setForm({ ...form, skills: event.target.value })}
            />
          </label>
          <label className="span-2">
            Work History
            <textarea
              rows="3"
              value={form.workHistory}
              onChange={(event) => setForm({ ...form, workHistory: event.target.value })}
            />
          </label>
          <label className="span-2">
            Bio
            <textarea
              rows="4"
              value={form.bio}
              onChange={(event) => setForm({ ...form, bio: event.target.value })}
            />
          </label>
          <label className="span-2">
            Re-upload CV
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] || null;
                setForm({ ...form, cvFile: nextFile });
                setCvStatus(nextFile?.name || user?.cvFileName || "");
              }}
            />
          </label>
          {cvStatus ? (
            <p className="helper-copy wide-copy span-2">Current CV: {cvStatus}</p>
          ) : null}
        </form>
      ) : user ? (
        <div className="profile-layout">
          <section className="profile-hero-card">
            <div className="profile-avatar-badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M6.5 18c1.2-2.7 3.1-4.1 5.5-4.1s4.3 1.4 5.5 4.1"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.8"
                />
              </svg>
            </div>
            <h3>{user.name || title}</h3>
            <span className="profile-role-pill">{user.role || "User"}</span>
            <div className="profile-wallet-strip">
              <span>Wallet</span>
              <strong>{walletPreview}</strong>
            </div>
            <div className="profile-stats-row">
              <button
                className="profile-stat-card profile-stat-button"
                type="button"
                onClick={onViewJobs}
                disabled={!onViewJobs}
              >
                <strong>{resolvedStats.jobs}</strong>
                <span>Jobs</span>
                <small>View jobs</small>
              </button>
              <button
                className="profile-stat-card profile-stat-button"
                type="button"
                onClick={onViewActive}
                disabled={!onViewActive}
              >
                <strong>{resolvedStats.active}</strong>
                <span>Active</span>
                <small>View active</small>
              </button>
              <article className="profile-stat-card">
                <strong>{resolvedStats.rating}</strong>
                <span>Rating</span>
              </article>
            </div>
            {editable ? (
              <button className="ghost-button profile-edit-button" type="button" onClick={() => setIsEditing(true)}>
                Edit Profile
              </button>
            ) : null}
          </section>

          <section className="profile-section-card">
            <h4>About</h4>
            <p className="helper-copy wide-copy">
              {user.bio || "No bio added yet. Click Edit Profile to add one."}
            </p>
          </section>

          <div className="profile-detail-columns">
            <section className="profile-section-card">
              <h4>Job Description</h4>
              {skillsList.length > 0 ? (
                <div className="profile-tag-row">
                  {skillsList.map((skill) => (
                    <span key={skill} className="profile-skill-tag">
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="helper-copy wide-copy">No skills added yet.</p>
              )}
            </section>

            <section className="profile-section-card">
              <h4>Work History</h4>
              <p className="helper-copy wide-copy">
                {user.workHistory || "No work history added yet."}
              </p>
            </section>
          </div>
        </div>
      ) : (
        <p className="helper-copy wide-copy">Register and log in with your wallet to manage a profile.</p>
      )}
    </section>
  );
}
