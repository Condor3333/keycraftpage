"use client";

import Link from 'next/link';
import styles from './Hero.module.css';
import { useSession } from 'next-auth/react';

export default function Hero() {
  const { data: session, status } = useSession();

  const isLoading = status === "loading";
  const appUrl = process.env.NEXT_PUBLIC_APP_EDITOR_URL || 'http://app.keycraft.org:3001';

  return (
    <section className={styles.hero}>
      {/* Background Video */}
      <div className={styles.videoBackground}>
        <video
          src="/Background Loop.mp4"
          autoPlay
          muted
          loop
          playsInline
          className={styles.backgroundVideo}
        />
        <div className={styles.videoOverlay}></div>
      </div>

      {/* Centered Content */}
      <div className={styles.heroContent}>
        <h1 className={styles.headline}>
          Create Piano Rolls
          <br />
          Intuitively
        </h1>
        <p className={styles.subHeadline}>
          KeyCraft is a piano roll editor that makes music composition simple, intuitive, and enjoyable.
        </p>
        <div className={styles.featureList}>
          <div className={styles.featureItem}>
            <span className={styles.checkmark}>✓</span>
            <span>Complete Music Editor</span>
          </div>
          <div className={styles.featureItem}>
            <span className={styles.checkmark}>✓</span>
            <span>AI Transcription</span>
          </div>
          <div className={styles.featureItem}>
            <span className={styles.checkmark}>✓</span>
            <span>Customize Visuals *NEW*</span>
          </div>
          <div className={styles.featureItem}>
            <span className={styles.checkmark}>✓</span>
            <span>Customize Audio *NEW*</span>
          </div>
          <div className={styles.featureItem}>
            <span className={styles.checkmark}>✓</span>
            <span>Sheet Music *NEW*</span>
          </div>
          <div className={styles.featureItem}>
            <span className={styles.checkmark}>✓</span>
            <span>Desktop, Tablet, and Phone</span>
          </div>
        </div>
        <div className={styles.ctaButtons}>
          {isLoading ? (
            <div className={`${styles.button} global-primary-button ${styles.loadingButton}`}>Loading...</div>
          ) : session ? (
            <a href={appUrl} target="_blank" rel="noopener noreferrer" className={`${styles.button} global-primary-button`}>
              Start KeyCraft
            </a>
          ) : (
            <Link href="/#membership" className={`${styles.button} global-primary-button`}>
              Start KeyCraft
            </Link>
          )}
          <a href="https://discord.gg/aCSC8qqGjz" target="_blank" rel="noopener noreferrer" className={`${styles.button} ${styles.secondaryButton}`}>
            Join Discord
          </a>
        </div>
      </div>
    </section>
  );
}
