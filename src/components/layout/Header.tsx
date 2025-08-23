"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import styles from './Header.module.css';
import { useSession } from 'next-auth/react';
import { getPublicAssetUrl } from '../../config/cdn';

export default function Header() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  // Use configured app URL or default to app subdomain
  const appUrl = process.env.NEXT_PUBLIC_APP_EDITOR_URL || 'http://app.keycraft.org:3001';

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const logoSrc = getPublicAssetUrl('/images/logo.png');

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link href="/" className={styles.logoContainer}>
          <Image 
            src={logoSrc} 
            alt="Cursor Logo" 
            width={120} 
            height={32} 
            className={styles.logo}
          />
          <span className={styles.logoText}>KeyCraft</span>
        </Link>

        <button className={styles.hamburgerButton} onClick={toggleMenu}>
          {menuOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          )}
        </button>

        <nav className={styles.navigation}>
          {/* <Link href="/#beta" className={styles.navLink}>Membership</Link> */}
          <Link href="/#features" className={styles.navLink}>Features</Link>
          <Link 
            href="/#membership"
            className={`${styles.navLink} ${styles.midiPlayerLink}`}
          >
            Membership
          </Link>
          {/* <Link href="/tutorial" className={styles.navLink}>Tutorial</Link> */}
          <Link href="/contact" className={styles.navLink}>Contact</Link>
        </nav>

        <div className={`${styles.actions} ${styles.desktopActions}`}>
          {status === "loading" ? (
            <div className={styles.signInButton}>Loading...</div>
          ) : session ? (
            <div className={styles.userInfo}>
              {session.user?.image && (
                <Image 
                  src={session.user.image} 
                  alt={session.user.name || "User"} 
                  width={32} 
                  height={32} 
                  className={styles.userAvatar} 
                />
              )}
              <Link href="/dashboard" className={styles.userNameLink}>
                <span>{session.user?.name || session.user?.email}</span>
              </Link>
            </div>
          ) : (
            <Link href="/signin" className={styles.signInButton}>
              Sign in
            </Link>
          )}
          {status === "loading" ? (
            <div className={`${styles.downloadButton} ${styles.loadingButton}`}>Loading...</div>
          ) : session ? (
            <a 
              href={appUrl}
              target="_blank" 
              rel="noopener noreferrer"
              className={styles.downloadButton}
            >
              Start Keycraft
            </a>
          ) : (
            <Link href="/#membership" className={styles.downloadButton}>
              Start Keycraft
            </Link>
          )}
        </div>
      </div>

      {menuOpen && (
        <div className={styles.mobileNavigationContainer}>
          <nav className={styles.mobileNavigation}>
            {/* <Link href="/#beta" className={styles.mobileNavLink} onClick={toggleMenu}>Membership</Link> */}
            <Link href="/#features" className={styles.mobileNavLink} onClick={toggleMenu}>Features</Link>
            <Link 
                href="/#beta"
                className={`${styles.mobileNavLink} ${styles.midiPlayerLinkMobile}`} 
                onClick={toggleMenu}
            >
                Early Access
            </Link>
            {/* <Link href="/tutorial" className={styles.mobileNavLink} onClick={toggleMenu}>Tutorial</Link> */}
            <Link href="/contact" className={styles.mobileNavLink} onClick={toggleMenu}>Contact</Link>
            <div className={styles.mobileActions}>
              {status === "loading" ? (
                <div className={`${styles.signInButton} ${styles.mobileSignInButton}`}>Loading...</div>
              ) : session ? (
                <div className={styles.mobileUserInfo}>
                  {session.user?.image && (
                    <Image 
                      src={session.user.image} 
                      alt={session.user.name || "User"} 
                      width={28} 
                      height={28} 
                      className={styles.userAvatarMobile} 
                    />
                  )}
                  <Link href="/dashboard" className={styles.userNameLinkMobile} onClick={toggleMenu}>
                    <span>{session.user?.name || session.user?.email}</span>
                  </Link>
                </div>
              ) : (
                <Link href="/signin" className={`${styles.signInButton} ${styles.mobileSignInButton}`} onClick={toggleMenu}>
                  Sign in
                </Link>
              )}
              {status === "loading" ? (
                <div className={`${styles.downloadButton} ${styles.mobileDownloadButton} ${styles.loadingButton}`}>Loading...</div>
              ) : session ? (
                <a 
                  href={appUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`${styles.downloadButton} ${styles.mobileDownloadButton}`}
                  onClick={toggleMenu}
                >
                  Start Keycraft
                </a>
              ) : (
                <Link 
                  href="/#membership"
                  className={`${styles.downloadButton} ${styles.mobileDownloadButton}`}
                  onClick={toggleMenu}
                >
                  Start Keycraft
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
