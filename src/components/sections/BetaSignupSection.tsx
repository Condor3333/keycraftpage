'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import styles from './BetaSignupSection.module.css';

export default function BetaSignupSection() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <section id="beta" className={styles.betaSection}><div>Loading...</div></section>;
  }

  // User is authenticated
  if (status === 'authenticated') {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://app.keycraft.org:3001';
    return (
      <section id="beta" className={styles.betaSection}>
        <div className={styles.container}>
          <h2>Welcome to KeyCraft!</h2>
          <p>You're signed in and ready to start creating music.</p>
          <a href={appUrl} target="_blank" rel="noopener noreferrer" className="global-primary-button">
            Start KeyCraft
          </a>
        </div>
      </section>
    );
  }

  // User is not authenticated
  return (
    <section id="beta" className={styles.betaSection}>
      <div className={styles.container}>
        <h2>Get Started with KeyCraft</h2>
        <p>Join thousands of musicians creating amazing music with our powerful piano roll editor.</p>
        <div className={styles.ctaButtons}>
          <Link href="/register" className="global-primary-button">
            Sign Up Free
          </Link>
          <Link href="/signin" className="global-secondary-button">
            Sign In
          </Link>
        </div>
      </div>
    </section>
  );
} 