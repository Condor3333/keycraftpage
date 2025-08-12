'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import styles from './BetaCodeEntry.module.css';

export default function BetaCodeEntry() {
  const { update } = useSession();
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
    console.log('[BetaCodeEntry] API Response:', data);

    if (response.ok) {
      setMessage(data.message || 'Success! You now have full access.');
      setMessageType('success');
      setIsSuccess(true);
      console.log('[BetaCodeEntry] Calling update() with:', data.data);
      await update(data.data); 
      console.log('[BetaCodeEntry] update() call finished.');
    } else {
      setMessage(data.error || 'An unknown error occurred.');
      setMessageType('error');
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <section className={styles.betaSection}>
        <div className={styles.container}>
          <h2>Success!</h2>
          <p>{message}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="global-primary-button"
          >
            Go to My Dashboard
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.betaSection}>
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
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.trim().toUpperCase())}
            placeholder="ENTER CODE HERE"
            className={styles.input}
            disabled={isLoading}
            required
          />
          <button type="submit" className="global-primary-button" disabled={isLoading || !code}>
            {isLoading ? 'Verifying...' : 'Activate Access'}
          </button>
        </form>
        {message && <p className={`${styles.message} ${styles[messageType]}`}>{message}</p>}
      </div>
    </section>
  );
} 