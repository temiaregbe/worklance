import { useEffect, useState } from "react";
import { ProfileCard } from "../components/ProfileCard";
import { listUploadsByOwner } from "../utils/storageApi";

export function ProfilePage({ account, currentUser }) {
  const [cvRecord, setCvRecord] = useState(null);
  const [uploads, setUploads] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadUploads() {
      try {
        const nextUploads = account ? await listUploadsByOwner(account) : [];
        const nextCv = nextUploads.find((upload) => upload.id === currentUser?.cvUploadId) || null;

        if (!active) {
          return;
        }

        setUploads(nextUploads);
        setCvRecord(nextCv);
      } catch {
        if (!active) {
          return;
        }
        setUploads([]);
        setCvRecord(null);
      }
    }

    void loadUploads();
    return () => {
      active = false;
    };
  }, [account, currentUser?.cvUploadId]);

  function openUpload(record) {
    if (!record?.gatewayUrl) {
      return;
    }

    window.open(record.gatewayUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="page-layout role-layout">
      <section className="profile-page-shell">
        <section className="content-card clean-panel profile-page-main">
          <div className="panel-head profile-page-head">
            <div>
              <p className="section-kicker">Profile</p>
              <h3>{currentUser?.role === "client" ? "Client Profile" : "Freelancer Profile"}</h3>
            </div>
          </div>

          <div className="profile-summary-grid">
            <article className="profile-summary-card">
              <span>Wallet</span>
              <strong>{account || "Not connected"}</strong>
            </article>
            <article className="profile-summary-card">
              <span>Status</span>
              <strong>{currentUser ? "Active profile" : "No active profile"}</strong>
            </article>
            <article className="profile-summary-card">
              <span>Email</span>
              <strong>{currentUser?.email || "Not added"}</strong>
            </article>
            <article className="profile-summary-card">
              <span>CV</span>
              <strong>{currentUser?.cvFileName || "Not added"}</strong>
            </article>
          </div>

          <ProfileCard
            title={currentUser?.role === "client" ? "Client Profile" : "Freelancer Profile"}
            user={currentUser}
            compact
          />

          <section className="content-card profile-bio-card">
            <div className="card-heading-row">
              <div>
                <p className="section-kicker">About</p>
                <h3>Profile Bio</h3>
              </div>
            </div>
            <p className="helper-copy wide-copy profile-bio-copy">
              {currentUser?.bio || "No bio has been added to this profile yet."}
            </p>
          </section>

          <section className="content-card profile-bio-card">
            <div className="card-heading-row">
              <div>
                <p className="section-kicker">CV</p>
                <h3>Uploaded Resume</h3>
              </div>
              {cvRecord ? (
                <button className="secondary-button" type="button" onClick={() => openUpload(cvRecord)}>
                  Open CV
                </button>
              ) : null}
            </div>
            <p className="helper-copy wide-copy profile-bio-copy">
              {cvRecord
                ? `${cvRecord.fileName} stored in IPFS and referenced through the backend database.`
                : "No CV file has been uploaded for this profile yet."}
            </p>
          </section>

          <section className="content-card profile-bio-card">
            <div className="card-heading-row">
              <div>
                <p className="section-kicker">Upload Database</p>
                <h3>Stored Uploads</h3>
              </div>
            </div>
            {uploads.length > 0 ? (
              <div className="detail-grid">
                {uploads.map((upload) => (
                  <article key={upload.id}>
                    <span>{upload.category === "profile-cv" ? "Profile CV" : "Project File"}</span>
                    <strong>{upload.fileName}</strong>
                  </article>
                ))}
              </div>
            ) : (
              <p className="helper-copy wide-copy profile-bio-copy">
                No uploaded records have been stored for this wallet yet.
              </p>
            )}
          </section>
        </section>
      </section>
    </main>
  );
}
