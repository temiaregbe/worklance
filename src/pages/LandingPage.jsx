import { Link } from "react-router-dom";

export function LandingPage({
  account,
  currentUser,
  connectWallet,
  disconnectWallet,
  isBusy,
  canAccessApp
}) {
  return (
    <main className="page-layout">
      <section className="landing-hero">
        <div className="hero-badge">Secured by Blockchain Technology</div>
        <h2>
          Hire Talent.
          <br />
          <span>Get Paid.</span>
          <br />
          Trust the Chain.
        </h2>
        <p className="landing-support landing-hero-copy">
          Connect with skilled freelancers across every industry. Use escrow-backed smart contracts
          to hire with confidence, submit work transparently, and release payment automatically.
        </p>

        <div className="hero-actions hero-actions-center">
          <button className="primary-button hero-button" onClick={connectWallet} disabled={isBusy}>
            {account ? "Wallet Connected" : "Connect Wallet"}
          </button>
          {account ? (
            <button className="ghost-button hero-button" type="button" onClick={disconnectWallet}>
              Disconnect Wallet
            </button>
          ) : null}
          <Link className="ghost-button hero-button" to={currentUser ? "/profile" : "/signup"}>
            {currentUser ? "Manage Profile" : "Create Account"}
          </Link>
        </div>

        <div className="hero-role-switch">
          {canAccessApp ? (
            <>
              <Link className="secondary-button hero-role-button" to="/client">
                Client View
              </Link>
              <Link className="secondary-button hero-role-button" to="/freelancer">
                Freelancer View
              </Link>
            </>
          ) : (
            <>
              <button className="hero-role-button disabled" type="button" disabled>
                Client View
              </button>
              <button className="hero-role-button disabled" type="button" disabled>
                Freelancer View
              </button>
            </>
          )}
        </div>
      </section>

      <section className="landing-why" id="about">
        <div className="landing-section-head">
          <h3>Why WorkLance?</h3>
          <p>
            Traditional freelance platforms take a large cut and still leave payment trust to the
            platform. WorkLance uses blockchain escrow to make the process faster and safer.
          </p>
        </div>

        <div className="landing-feature-grid">
          <article className="landing-feature-card">
            <h4>Secure Escrow Payments</h4>
            <p>Funds stay locked in smart contracts until the client approves the submitted work.</p>
          </article>
          <article className="landing-feature-card">
            <h4>Instant Payment Release</h4>
            <p>Once work is accepted, payment moves automatically without bank delays or disputes.</p>
          </article>
          <article className="landing-feature-card">
            <h4>Work From Anywhere</h4>
            <p>Hire or work globally with transparent on-chain records and role-based workflows.</p>
          </article>
          <article className="landing-feature-card">
            <h4>Verified Activity Trail</h4>
            <p>Listings, proposals, file records, and contract actions stay visible for accountability.</p>
          </article>
        </div>
      </section>

      <section className="landing-cta">
        <div className="landing-section-head compact">
          <h3>Ready to get started?</h3>
          <p>Join clients and freelancers already working with transparent escrow-backed agreements.</p>
        </div>

        <div className="hero-actions hero-actions-center">
          <Link className="primary-button hero-button" to={currentUser ? "/profile" : "/signup"}>
            {currentUser ? "Open Profile" : "Create Account"}
          </Link>
          {canAccessApp ? (
            <Link
              className="secondary-button hero-button"
              to={currentUser?.role === "freelancer" ? "/freelancer" : "/client"}
            >
              Browse Jobs First
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
