'use client'; // Required for useState

import React, { useState, useEffect } from 'react';
import Link from 'next/link'; // Re-added import
import { useSession } from 'next-auth/react';
import styles from './MembershipSection.module.css'; // Changed from LPMembership.css to pricing.css and updated path

export default function MembershipSection() { // Renamed component
  const { data: session, status } = useSession();
  // const [billingPeriod, setBillingPeriod] = useState('monthly'); // Removed unused state
  const [userPlans, setUserPlans] = useState({
    freeTier: true, // All users start with free tier conceptually
    tier1: false,
    tier2: false,
  });
  const [plansChecked, setPlansChecked] = useState(false);
  const [localStorageValue, setLocalStorageValue] = useState('loading...'); // For demo purchase display

  // Get user email from session
  // const userEmail = session?.user?.email || ''; // Not strictly needed if using direct payment links without prefill via JS
  
  // Access localStorage safely with useEffect
  useEffect(() => {
    if (status === 'loading' || !session?.user?.email) {
      localStorage.removeItem('demo-purchased-tier1');
      localStorage.removeItem('demo-purchased-tier2');
    }
    const value1 = localStorage.getItem('demo-purchased-tier1') || 'null';
    const value2 = localStorage.getItem('demo-purchased-tier2') || 'null';
    setLocalStorageValue(`Tier1: ${value1}, Tier2: ${value2}`);
  }, [status, session?.user?.email]);
  
  // Reset localStorage purchase state for testing
  const resetPurchaseStatus = () => {
    localStorage.removeItem('demo-purchased-tier1');
    localStorage.removeItem('demo-purchased-tier2');
    setUserPlans({ freeTier: true, tier1: false, tier2: false });
    setLocalStorageValue('Tier1: null, Tier2: null');

    // Consider also calling an API to reset on server if your demo purchase affects DB
  };
  
  // Fetch user's purchased plans
  useEffect(() => {
    function determineUserPlans() {
      if (status === 'authenticated' && session?.user?.email) {

        if (session.user.hasPaid) { // Check hasPaid from session

          // For simplicity, if hasPaid, assume they have access to all paid features shown
          // A more robust solution would check session.user.activePlans against specific plan IDs.
          setUserPlans({
            freeTier: true, 
            tier1: true,    
            tier2: true     
          });
          // Update demo localStorage for visual consistency in dev tools
          localStorage.setItem('demo-purchased-tier1', 'true'); 
          localStorage.setItem('demo-purchased-tier2', 'true');
          setLocalStorageValue('Tier1: true (derived from hasPaid), Tier2: true (derived from hasPaid)');
        } else {

          setUserPlans({ freeTier: true, tier1: false, tier2: false });
          localStorage.removeItem('demo-purchased-tier1');
          localStorage.removeItem('demo-purchased-tier2');
          setLocalStorageValue('Tier1: null, Tier2: null');
        }
      } else {

        setUserPlans({ freeTier: true, tier1: false, tier2: false });
      }
      setPlansChecked(true);
    }

    determineUserPlans();
    return () => {
      setPlansChecked(false);
    };
  }, [status, session]); // Depend on the whole session object to catch user changes and hasPaid updates

  // Direct Stripe Payment Links from .env.local
  const tier1PaymentLink = process.env.NEXT_PUBLIC_STRIPE_TIER1_PAYMENT_LINK || '#';
  const tier2PaymentLink = process.env.NEXT_PUBLIC_STRIPE_TIER2_PAYMENT_LINK || '#';

  // Don't render the plans until we've checked storage
  if (!plansChecked && status !== 'loading') {
    return <div className={styles['alt-pricing-section']}>Loading plans...</div>; // Updated className
  }

  return (
    <section id="membership" className={styles['alt-pricing-section']}> {/* Added id="membership" and updated className*/}
      <div className={styles['merged-pricing-container']}>
        
        <div className={styles['merged-pricing-header']}>
          <h1>Buy Now</h1>
          <p className={styles['merged-pricing-subtitle']}></p>
        </div>

        {/* For testing only - remove in production */}
        <div style={{ marginBottom: '20px', padding: '10px', border: '1px dashed #ccc', maxWidth: '600px', margin: '0 auto 20px' }}>
          <p style={{ fontSize: '14px' }}>Testing Controls (Dev Mode)</p>
          <button 
            onClick={resetPurchaseStatus}
            style={{ padding: '5px 10px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
          >
            Reset Demo Purchase Status
          </button>
          <p style={{ fontSize: '12px', marginTop: '5px' }}>
            Session `hasPaid`: {session?.user?.hasPaid?.toString() ?? 'undefined/loading'} <br />
            Demo localStorage: {localStorageValue}
          </p>
        </div>

        <div className={styles['merged-plans-grid']}>
          
          {/* Free Tier Card */}
          <div className={styles['alt-plan-card']}>
            <h3>Free Version</h3>
            <div className={styles['alt-price-wrapper']}>
              <span className={styles['alt-current-price']}>$0</span>
              <span className={styles['alt-price-currency']}></span>
            </div>
            <p className={styles['alt-plan-description']}>Basic access.</p>
            <ul className={styles['alt-features-list-in-card']}>
              <li>Limited Editor Features</li>
              <li>1 Project</li>
          
            </ul>
            {status === 'authenticated' ? (
              <button className={`${styles['alt-deploy-button']} global-primary-button`} disabled style={{backgroundColor: '#cccccc'}}>Currently Active</button>
            ) : (
              <Link href="/register" className={`${styles['alt-deploy-button']} global-primary-button`}>TRY FREE</Link>
            )}
            {/* <img src="/images/keyboard.png" alt="Keyboard" className={styles['plan-corner-image']} /> */}
          </div>

          {/* Tier 1 Card */}
          <div className={styles['alt-plan-card']}>
            {session?.user?.hasPaid && (userPlans.tier1 || userPlans.tier2) && 
              <div style={{position: 'absolute', top: '10px', left: '10px', backgroundColor: '#4CAF50', color: 'white', padding: '5px 10px', borderRadius: '4px', fontSize: '12px'}}>
                PURCHASED
              </div>
            }
            <h3>KeyCraft </h3>
            <div className={styles['alt-price-wrapper']}>
              {/* <span className={styles['alt-original-price']}>$49</span> */}
              <span className={styles['alt-current-price']}>$49</span>
              <span className={styles['alt-price-currency']}>/year</span>
            </div>
            <p className={styles['alt-plan-description']}>All Features</p>
            <ul className={styles['alt-features-list-in-card']}>
              <li>Full Access to Piano Roll Editor</li>
              <li>Multiple Projects (20)</li>
              <li>Limited AI Transcriptions (5/month)</li>
            </ul>
            {session?.user?.hasPaid && (userPlans.tier1 || userPlans.tier2) ? (
              <button className={`${styles['alt-deploy-button']} global-primary-button`} disabled style={{backgroundColor: '#cccccc'}}>PURCHASED</button>
            ) : status === 'authenticated' ? (
              <a href={tier1PaymentLink} target="_blank" rel="noopener noreferrer" className={`${styles['alt-deploy-button']} global-primary-button`}>GET TIER 1</a>
            ) : (
              <Link href={`/signin?callbackUrl=/membership`} className={`${styles['alt-deploy-button']} global-primary-button`}>GET KEYCRAFT</Link>
            )}
            {/* <img src="/images/upright.png" alt="Upright piano" className={`${styles['plan-corner-image']} ${styles['plan-corner-image--upright']}`} /> */}
          </div>

          {/* Tier 2 Card (Launch Deal) */}
          <div className={`${styles['alt-plan-card']} ${styles['alt-popular-card']}`}>
            {session?.user?.hasPaid && userPlans.tier2 && 
              <div style={{position: 'absolute', top: '10px', left: '10px', backgroundColor: '#4CAF50', color: 'white', padding: '5px 10px', borderRadius: '4px', fontSize: '12px'}}>
                PURCHASED
              </div>
            }
            <div className={styles['alt-popular-badge']}>LAUNCH DEAL</div>
            <h3>KeyCraft Premium</h3>
            <div className={styles['alt-price-wrapper']}>
              <span className={styles['alt-original-price']}>$99</span>
              <span className={styles['alt-current-price']}>$79</span>
              <span className={styles['alt-price-currency']}>/year</span>
            </div>
            <p className={styles['alt-plan-description']}>Maximum access.</p>
            <ul className={styles['alt-features-list-in-card']}>
              <li>Full Access to Piano Roll Editor</li>
              <li>Unlimited Projects</li>
              <li>Maximum AI Transcriptions (20/month)</li>
            </ul>
            {session?.user?.hasPaid && userPlans.tier2 ? (
              <button className={`${styles['alt-deploy-button']} global-primary-button`} disabled style={{backgroundColor: '#cccccc'}}>PURCHASED</button>
            ) : status === 'authenticated' ? (
              <a href={tier2PaymentLink} target="_blank" rel="noopener noreferrer" className={`${styles['alt-deploy-button']} global-primary-button`}>GET TIER 2</a>
            ) : (
              <Link href={`/signin?callbackUrl=/membership`} className={`${styles['alt-deploy-button']} global-primary-button`}>GET KEYCRAFT PREMIUM</Link>
            )}
            <img src="/images/grand.png" alt="Grand piano" className={`${styles['plan-corner-image']} ${styles['plan-corner-image--grand']}`} />
          </div>

        </div>
      </div>
    </section>
  );
} 
