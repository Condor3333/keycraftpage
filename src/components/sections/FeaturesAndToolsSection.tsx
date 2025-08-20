'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './FeaturesAndToolsSection.module.css';
import useIsVisible from '../../hooks/useIsVisible';
import { getPublicAssetUrl } from '../../config/cdn';


// Updated placeholder images to use CDN
const placeholderImage1 = getPublicAssetUrl("/images/placeholder-tool-editing.png");
const placeholderImage2 = getPublicAssetUrl("/images/placeholder-tool-annotation.png");
const placeholderImage3 = getPublicAssetUrl("/images/placeholder-tool-chords.png");
const placeholderImage4 = getPublicAssetUrl("/images/placeholder-tool-midi.png");
const placeholderImage6 = "/images/placeholder-tool-playback.png";
const placeholderImage7 = "/images/placeholder-tool-sharing.png";

interface ToolCardProps {
  title: string;
  description: string;
  images?: { src: string; alt: string }[];
  videoSrc?: string;
  comingSoonFeatures?: string[];
}

const ToolCard: React.FC<ToolCardProps> = ({ title, description, images, videoSrc, comingSoonFeatures }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [cardWrapperRef, isCardVisible] = useIsVisible<HTMLDivElement>({ threshold: 0.5 });
  const videoElementRef = useRef<HTMLVideoElement>(null);

  console.log(`ToolCard '${title}' videoSrc:`, videoSrc);

  useEffect(() => {
    if (!videoSrc && images && images.length > 1) {
      const intervalId = setInterval(() => {
        setCurrentImageIndex(prevIndex => (prevIndex + 1) % images.length);
      }, 2000);
      return () => clearInterval(intervalId);
    }
  }, [images, videoSrc]);

  useEffect(() => {
    const currentVideo = videoElementRef.current;
    if (videoSrc && currentVideo) {
      if (isCardVisible) {
        currentVideo.play().catch(error => console.error("Video play failed:", error));
      } else {
        currentVideo.pause();
      }
    }
  }, [isCardVisible, videoSrc]);

  return (
    <div className={styles.toolCardWrapper} ref={cardWrapperRef}>
      <h3 className={styles.externalCardTitle}>{title}</h3>
      
      <div className={styles.toolCard}>
        {comingSoonFeatures ? (
          <div className={styles.comingSoonList}>
            <ul>
              {comingSoonFeatures.map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>
          </div>
        ) : videoSrc ? (
          <video 
            ref={videoElementRef}
            src={videoSrc} 
            className={styles.toolCardVideo} 
            muted 
            loop 
            controls={false}
            playsInline
          />
        ) : (
          <img src={images![currentImageIndex].src} alt={images![currentImageIndex].alt} className={styles.toolCardImage} />
        )}
      </div>
    </div>
  );
};

interface FeatureCardProps {
  title: string;
  description: string;
  videoSrc: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ title, description, videoSrc }) => (
  <div className={styles.featureCard}>
    <div className={styles.videoContainer}>
      <video
        src={getPublicAssetUrl(videoSrc)}
        autoPlay
        height={300}
        style={{ objectFit: "cover" }}
      />
    </div>
    <div className={styles.textContainer}>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  </div>
);

export default function FeaturesAndToolsSection() {
  const [mainFeatureVideoRef1, isMainFeatureVideo1Visible] = useIsVisible<HTMLVideoElement>({ threshold: 0.5 });
  const [mainFeatureVideoRef2, isMainFeatureVideo2Visible] = useIsVisible<HTMLVideoElement>({ threshold: 0.5 });

  const mainVideoElementRef1 = useRef<HTMLVideoElement>(null);
  const mainVideoElementRef2 = useRef<HTMLVideoElement>(null);

  const mainToolbarVideoSrc = getPublicAssetUrl("/KCMPvideos/KCVidToolbar.mp4");
  const mainKCVid1Src = getPublicAssetUrl("/KCMPvideos/KCVid1.mp4");
  console.log('Main Toolbar Video Src:', mainToolbarVideoSrc);
  console.log('Main KCVid1 Src:', mainKCVid1Src);

  useEffect(() => {
    const vid1 = mainVideoElementRef1.current;
    if (vid1) {
      vid1.playbackRate = 2.0;
      if (isMainFeatureVideo1Visible) vid1.play().catch(e => console.error("Vid1 play failed", e));
      else vid1.pause();
    }
  }, [isMainFeatureVideo1Visible]);

  useEffect(() => {
    const vid2 = mainVideoElementRef2.current;
    if (vid2) {
      vid2.playbackRate = 2.0;
      if (isMainFeatureVideo2Visible) vid2.play().catch(e => console.error("Vid2 play failed", e));
      else vid2.pause();
    }
  }, [isMainFeatureVideo2Visible]);

  const toolData = [
    {
      title: "Add Notes",
      description: "Precisely edit MIDI notes, velocity, timing, and duration.",
      images: [ { src: placeholderImage1, alt: "Advanced Note Editing" } ],
      videoSrc: getPublicAssetUrl("/KCMPvideos/KCVid3.mp4")
    },
    {
      title: "Add Chords",
      description: "Add comments, lyrics, or chord names directly on your piano roll.",
      images: [ { src: placeholderImage2, alt: "Text Annotations" } ],
      videoSrc: getPublicAssetUrl("/KCMPvideos/KCVid4.mp4")
    },
    {
      title: "Add Scales, Arpeggios and Runs",
      description: "Experiment with chord voicings and progressions effortlessly.",
      images: [ { src: placeholderImage3, alt: "Chord Generation" } ],
      videoSrc: getPublicAssetUrl("/KCMPvideos/KCVid2.mp4")
    },
    {
      title: "Annotate lyrics, theory and titles",
      description: "Seamlessly import and export MIDI files.",
      images: [ { src: placeholderImage4, alt: "MIDI Import/Export" } ],
      videoSrc: getPublicAssetUrl("/KCMPvideos/FlandersField.mp4")
    },
    {
      title: "Colors and Visuals",
      description: "Personalize your workspace with custom backgrounds and colors.",
      images: [
        { src: getPublicAssetUrl("/images/color1.png"), alt: "Color Scheme 1" },
        { src: getPublicAssetUrl("/images/color2.png"), alt: "Color Scheme 2" },
        { src: getPublicAssetUrl("/images/color3.png"), alt: "Color Scheme 3" }
      ]
    },
    {
      title: "Coming Soon",
      description: "Exciting new features on the horizon",
      comingSoonFeatures: [
        "AI-Powered Music Generation",
        "Mobile App for iOS and Android",
        "Tablet-Optimized Interface",
        "Desktop Application",
        "Real-time Collaboration",
        "Advanced Music Theory Tools",
        "Smart Arrangement Assistant",
        "Enhanced MIDI Integration"
      ]
    }
  ];

  const duplicatedToolData = [...toolData, ...toolData, ...toolData];
  const storageImageSrc = getPublicAssetUrl("/images/Storage.png");
  console.log('Storage Image Src:', storageImageSrc);

  const [activeTab, setActiveTab] = useState('features');

  return (
    <div id="features" className={styles.featuresContainer}>
      <h1 className={styles['features-heading']}>Features</h1>
      
      <section className={styles.featureSection} ref={mainFeatureVideoRef1}>
        <div className={styles.featureText}>
          <h2 className={styles.featureTitle}>Comprehensive Editor</h2>
          <p className={styles.featureDescription}>
            Compose piano pieces without sheet music.<br />
            Your own workstation for piano.
          </p>
          
          <div className={styles.toolsList}>
            <div className={styles.toolCategory}>
              <h4>TOOLS</h4>
              <ul>
                <li>Add Note</li>
                <li>Add Run</li>
                <li>Add Chord</li>
                <li>Add Space</li>
                <li>Add Text</li>
                <li>Hand Color</li>
                <li>Wallpapers</li>
              </ul>
            </div>
            
            <div className={styles.toolCategory}>
              <h4>CONTROLS</h4>
              <ul>
                <li>Snap to Grid</li>
                <li>Grid</li>
                <li>Scale Highlights</li>
                <li>Fullscreen</li>
                <li>Note Names</li>
                <li>Zoom</li>
              </ul>
            </div>
            
            <div className={styles.toolCategory}>
              <h4>STYLE</h4>
              <ul>
                <li>Glow</li>
                <li>Roundness</li>
                <li>Bevel</li>
                <li>And More</li>
              </ul>
            </div>
            
            <div className={styles.toolCategory}>
              <h4>THEORY</h4>
              <ul>
                <li>Time Signature</li>
                <li>Transpose</li>
                <li>Tempo</li>
              </ul>
            </div>
          </div>
        </div>
        <div className={styles.featureImage}>
          <video 
            ref={mainVideoElementRef1}
            src={mainToolbarVideoSrc}
            className={styles.featureVideo} 
            muted 
            loop 
            controls 
            playsInline
          />
        </div>
      </section>

      <section className={styles.featureSection} ref={mainFeatureVideoRef2}>
        <div className={styles.featureImage}>
          <video 
            ref={mainVideoElementRef2}
            src={mainKCVid1Src}
            className={styles.featureVideo}
            muted 
            loop 
            controls 
            playsInline
          />
        </div>
        <div className={styles.featureText}>
          <h2 className={styles.featureTitle}>Learn Music Theory</h2>
          <p className={styles.featureDescription}>
            Learn how to read piano rolls with intelligent note detection. 
            Understand musical patterns and structures, making music theory easier to learn.
          </p>
          
          <div className={styles.featureList}>
            <div className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              <span>Chord Detection</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              <span>Scale Highlights</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              <span>Note Names</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.featureSection}>
        <div className={styles.featureImage}>
          <div className={styles.featureImagePlaceholder}>
            AI Transcription Demo
          </div>
        </div>
        <div className={styles.featureText}>
          <h2 className={styles.featureTitle}>AI Transcription</h2>
          <p className={styles.featureDescription}>
            Convert your audio and video recordings into piano rolls instantly. 
            Our advanced AI technology analyzes your music and creates accurate MIDI files 
            that you can edit and refine in the piano roll editor.
          </p>
          
          <div className={styles.featureList}>
            <div className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              <span>Audio/Video to MIDI</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              <span>Accurate Note Detection</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              <span>Download and Edit MIDI</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.featureSection}>
        <div className={styles.featureImage}>
          <div className={styles.featureImagePlaceholder}>
            Choose Audio
          </div>
        </div>
        <div className={styles.featureText}>
          <h2 className={styles.featureTitle}>Choose Audio</h2>
          <p className={styles.featureDescription}>
            Pick from a growing set of instrument sounds for playback and export.
          </p>
          <div className={`${styles.featureList} ${styles.audioList}`}>
            <div className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              <span>Piano</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              <span>Organ</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              <span>Synth</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              <span>Synth 2</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              <span>Guitar (Acoustic)</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              <span>Clean Electric Guitar</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              <span>Harp</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              <span>Harpsichord</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              <span>Electric Piano</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              <span>Vibraphone</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              <span>Choir</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              <span>Violin</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              <span>Cello</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              <span>Trumpet</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              <span>Fart Kit (fun)</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.featureSection}>
        <div className={styles.featureImage}>
          <div className={styles.featureImagePlaceholder}>
            Customize Visuals Demo
          </div>
        </div>
        <div className={styles.featureText}>
          <h2 className={styles.featureTitle}>Customize Visuals</h2>
          <p className={styles.featureDescription}>
            Personalize your piano roll with custom colors, backgrounds, and visual effects. 
            Create your perfect 
            visual environment for composing music.
          </p>
          
          <div className={styles.featureList}>
            <div className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              <span>Custom Colors</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              <span>Background Themes</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              <span>Note Effects</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.featureSection}>
        <div className={styles.featureImage}>
          <img 
            src={storageImageSrc} 
            alt="Cloud Storage" 
            className={styles.featureImageTag}
          />
        </div>
        <div className={styles.featureText}>
          <h2 className={styles.featureTitle}>Access on All Devices</h2>
          <p className={styles.featureDescription}>
            Your whole repertoire in one place. Access your piano rolls seamlessly across all your devices with cloud synchronization.
          </p>
          
          <div className={styles.deviceList}>
            <div className={styles.deviceItem}>
              <span className={styles.checkmark}>✓</span>
              <div className={styles.deviceInfo}>
                <strong>Desktop</strong>
                <span>Full-featured editor with keyboard shortcuts</span>
              </div>
            </div>
            
            <div className={styles.deviceItem}>
              <span className={styles.checkmark}>✓</span>
              <div className={styles.deviceInfo}>
                <strong>Tablet</strong>
                <span>Touch-optimized interface with stylus support</span>
              </div>
            </div>
            
            <div className={styles.deviceItem}>
              <span className={styles.checkmark}>✓</span>
              <div className={styles.deviceInfo}>
                <strong>Phone</strong>
                <span>Mobile optimized view for learning at the piano</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/*
      <section className={styles.toolsShowcaseContainer}>
        <div className={styles.titleContainer}>
          <h2 className={styles.mainTitle}>Tool Suite</h2>
          <div className={styles.subtitleWrapper}>
            <p className={styles.mainSubtitle}>
              Unleash your creativity with a suite of powerful and intuitive tools designed to bring your musical visions to life. Made for people with music in their minds but dont know sheet music. EASY TO USE.
            </p>
          </div>
        </div>
        <div className={styles.toolCardsRowContainer}>
          <div className={styles.toolCardsRow}>
            {duplicatedToolData.map((tool, index) => (
              <ToolCard
                key={`${tool.title}-${index}`}
                title={tool.title}
                description={tool.description}
                images={tool.images}
                videoSrc={tool.videoSrc}
                comingSoonFeatures={tool.comingSoonFeatures}
              />
            ))}
          </div>
        </div>
      </section>
      */}
    </div>
  );
}