'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import styles from './BetaSignupSection.module.css';
import { useRouter } from 'next/navigation';

export default function BetaSignupSection() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    setMessageType('');

    const response = await fetch('/api/verify-beta-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    const data = await response.json();
    console.log('[BetaSignupSection] API Response:', data);

    if (response.ok) {
      setMessage(data.message || 'Success! You now have full access.');
      setMessageType('success');
      setIsSuccess(true);
      console.log('[BetaSignupSection] Calling update() with:', data.data);
      await update(data.data);
      console.log('[BetaSignupSection] update() call finished.');
    } else {
      setMessage(data.error || 'An unknown error occurred.');
      setMessageType('error');
      setIsLoading(false);
    }
  };

  if (status === 'loading') {
    return <section id="beta" className={styles.betaSection}><div>Loading...</div></section>;
  }

  // User is authenticated
  if (status === 'authenticated') {
    const user = session.user as any; // Cast to access custom properties
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://app.keycraft.org:3001';
    // If user already has access, show a confirmation message
    if (user.hasPaid) {
        return (
            <section id="beta" className={styles.betaSection}>
                <div className={styles.container}>
                    <h2>You Have Full Access!</h2>
                    <p>Welcome to the beta. You're all set to use the application.</p>
                    <a href={appUrl} target="_blank" rel="noopener noreferrer" className="global-primary-button">
                        Go to App
                    </a>
                </div>
            </section>
        );
    }

    // If the submission was successful, show a success message and a button to continue.
    if (isSuccess) {
      return (
        <section id="beta" className={styles.betaSection}>
          <div className={styles.container}>
            <h2>Success!</h2>
            <p>{message}</p>
            <Link href="/dashboard" className="global-primary-button">
                Go to My Dashboard
            </Link>
          </div>
        </section>
      );
    }

    // Otherwise, show the beta code entry form
    return (
      <section id="beta" className={styles.betaSection}>
        <div className={styles.container}>
          <h2>Enter Your Beta Code</h2>
          <p>You're signed in! Enter your unique code below to unlock full access.</p>
          <p>Need a code? <a href="https://discord.gg/aCSC8qqGjz" target="_blank" rel="noopener noreferrer">Join our Discord server</a> to get one.</p>
          <form onSubmit={handleSubmit} className={styles.form}>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.trim())}
              placeholder="e.g., BETA-XYZ-123"
              className={styles.input}
              disabled={isLoading}
              required
            />
            <button type="submit" className="global-primary-button" disabled={isLoading || !code}>
              {isLoading ? 'Verifying...' : 'Activate My Access'}
            </button>
          </form>
          {message && <p className={`${styles.message} ${styles[messageType]}`}>{message}</p>}
        </div>
      </section>
    );
  }

  // User is not authenticated
  return (
    <section id="beta" className={styles.betaSection}>
      <div className={styles.container}>
        <h2>Early Access</h2>
        <p>We're currently in beta and want to communicate directly with our testers to gather feedback and provide support.</p>
        <ol className={styles.stepsList}>
          <li>Join the KeyCraft Discord</li>
          <li>Ask for an early access code</li>
          <li>Sign up or log in</li>
          <li>Enter your early access code to get full access to KeyCraft</li>
        </ol>
        <a href="https://discord.gg/aCSC8qqGjz" target="_blank" rel="noopener noreferrer" className="global-primary-button">
          Join Discord for Early Access Code
        </a>
      </div>
    </section>
  );
} 