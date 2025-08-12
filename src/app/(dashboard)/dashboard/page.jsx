'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import Link from 'next/link';
import './dashboard.css'; // Import the CSS file
import BetaCodeEntry from './BetaCodeEntry.tsx'; // Import the new component

export default function DashboardPage() {
  const { data: session, status } = useSession();

  console.log('[DashboardPage] Rendering with session status:', status, 'and session data:', session);

  // Show a loading spinner while the session is being fetched
  if (status === 'loading') {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  // If the session has loaded and is still null, it's a true unauthenticated state.
  // This might happen in rare edge cases, so we can redirect to signin.
  // The primary protection is the middleware.
  if (!session) {
    return (
      <div className="access-denied">
        <h1>Access Denied</h1>
        <p>You must be signed in to view this page.</p>
        <Link href="/signin" className="sign-in-link">
          Sign In
        </Link>
      </div>
    );
  }
  
  // From here, we know the user is authenticated.
  // Check for paid access.
  const user = session.user;
  const hasAccess = user && user.hasPaid;

  if (!hasAccess) {
    // If the user is authenticated but doesn't have access, show the BetaCodeEntry component.
    return <BetaCodeEntry />;
  }

  // Now that access is confirmed, we can safely destructure user properties
  const userName = user.name || 'User';
  const userEmail = user.email || 'N/A';
  const userImage = user.image;
  const hasPaid = user.hasPaid;
  const activePlans = user.activePlans || [];
  const emailVerified = user.emailVerified;
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://app.keycraft.org:3001';

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>My Account</h1>
      </header>

      <div className="dashboard-grid">
        <section className="card basic-info-card">
          <h2>Basic Information</h2>
          <div className="info-item">
            <span className="info-label">Name</span>
            <span className="info-value">{userName}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Email</span>
            <span className="info-value">{userEmail}</span>
          </div>
          {userImage && (
            <div className="info-item avatar-item">
              <span className="info-label">Avatar</span>
              <img src={userImage} alt="User avatar" className="user-avatar-dashboard" />
            </div>
          )}
           <div className="info-item">
            <span className="info-label">Email Verified</span>
            <span className={`info-value ${emailVerified ? 'verified' : 'not-verified'}`}>
              {emailVerified ? `Verified on ${new Date(emailVerified).toLocaleDateString()}` : 'Not Verified'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Subscription</span>
            <span className={`info-value ${hasPaid ? 'pro' : 'free'}`}>
              {hasPaid ? 'Pro' : 'Free'}
            </span>
          </div>
          {activePlans.length > 0 && (
            <div className="info-item">
              <span className="info-label">Active Plan(s)</span>
              <span className="info-value">{activePlans.join(', ')}</span>
            </div>
          )}
          <button className="dashboard-button manage-subscription">
            Manage Subscription
          </button>
        </section>

        <section className="card actions-card">
            <h2>Actions</h2>
            <a href={appUrl} target="_blank" rel="noopener noreferrer" className="dashboard-button start-keycraft-button">
                Start Keycraft
            </a>
            <button onClick={() => signOut({ callbackUrl: '/' })} className="dashboard-button sign-out">
                Sign Out
            </button>
        </section>
      </div>
    </div>
  );
}
