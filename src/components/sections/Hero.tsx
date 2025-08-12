"use client";


import Link from 'next/link'; // Import Link for buttons if they navigate
import styles from './Hero.module.css';
import { useSession } from 'next-auth/react'; // Import useSession
import { getPublicAssetUrl } from '../../config/cdn';


export default function Hero() {
  const { data: session, status } = useSession(); // Get session status

  const isLoading = status === "loading";
  // The appUrl should point to the separate editor application
  // In development, use the IP address
  const isDev = process.env.NODE_ENV === 'development';
  const appUrl = isDev ? 'http://192.168.2.19:3001' : (process.env.NEXT_PUBLIC_APP_URL || 'http://app.keycraft.org:3001');

  const heroVideoSrc = getPublicAssetUrl("/KCMPvideos/KCVidEditor.mp4");
  console.log('Hero video src:', heroVideoSrc);

  return (
    <section className={styles.hero}>
      <div className={styles.heroContent}>
        <h1 className={styles.headline}>
          Create Piano Rolls
          <br />
          Intuitively
        </h1>
        <p className={styles.subHeadline}>
          KeyCraft is a piano roll editor that makes music composition simple, intuitive, and enjoyable.
        </p>
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
            Join Discord for Early Access
          </a>
        </div>
      </div>
      <div className={styles.videoFrame}>
        <video
          src={heroVideoSrc}
          autoPlay
          muted
          loop
          playsInline
          className={styles.previewImage}
          style={{
            width: '120%',
            height: '120%',
            objectFit: 'contain'
          }}
        />
      </div>
    </section>
  );
}
