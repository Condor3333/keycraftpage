'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import Link from 'next/link';
import './dashboard.css'; // Import the CSS file

export default function DashboardPage() {
  const { data: session, status } = useSession();

  // Show a loading spinner while the session is being fetched
  if (status === 'loading') {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your studio...</p>
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
  // All authenticated users now have access to the dashboard.
  const user = session.user;
  
  // Now that access is confirmed, we can safely destructure user properties
  const userName = user.name || 'Composer';
  const userEmail = user.email || 'N/A';
  const userImage = user.image;
  const hasPaid = user.hasPaid;
  const activePlans = user.activePlans || [];
  
  const appUrl = process.env.NEXT_PUBLIC_APP_EDITOR_URL || 'http://app.keycraft.org:3001';

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>My Studio</h1>
        <p className="dashboard-subtitle">Your musical workspace</p>
      </header>

      <div className="dashboard-grid">
        <section className="card profile-card">
          <h2>Profile</h2>
          <div className="profile-info">
            {userImage && (
              <div className="avatar-container">
                <img src={userImage} alt="Profile" className="profile-avatar" />
              </div>
            )}
            <div className="info-item">
              <span className="info-label">Name</span>
              <span className="info-value">{userName}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Email</span>
              <span className="info-value">{userEmail}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Plan</span>
              <span className={`info-value ${hasPaid ? 'pro' : 'free'}`}>
                {hasPaid ? 'Pro' : 'Free'}
              </span>
            </div>
            {activePlans.length > 0 && (
              <div className="info-item">
                <span className="info-label">Features</span>
                <span className="info-value">{activePlans.join(', ')}</span>
              </div>
            )}
          </div>
          <button className="dashboard-button manage-subscription">
            Manage Plan
          </button>
        </section>

        <section className="card actions-card">
          <h2>Quick Actions</h2>
          <a href={appUrl} target="_blank" rel="noopener noreferrer" className="dashboard-button start-keycraft-button">
            Open KeyCraft
          </a>
          <button onClick={() => signOut({ callbackUrl: '/' })} className="dashboard-button sign-out">
            Sign Out
          </button>
        </section>
      </div>
    </div>
  );
}
