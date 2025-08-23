'use client';

import { useState } from 'react';
import './tutorial.css';

const blogPosts = [
  {
    id: 'getting-started',
    title: 'Your First Composition: Waltz',
    meta: 'March 15, 2024 by KeyCraft Team',
    content: (
      <>
        <p>Welcome to KeyCraft! This guide will walk you through creating your first song using our piano roll editor.</p>
        <section>
          <h2>Step 1: Click New Project</h2>
          <p>Open KeyCraft and create a new project. Familiarize yourself with the main interface: the toolbar at the top, the piano roll grid, and the keyboard at the bottom.</p>
        </section>
        <section>
          <h2>Step 2: Set Time Signature to 3/4</h2>
          <p>Waltzes are in 3/4 time, so we need to set the time signature to 3/4.</p>
        </section>
        <section>
          <h2>Step 3: Left hand Waltz Pattern</h2>
          <p>Typical Waltz pattern. You will recognize it from playing and watching waltz piano rolls.</p>
        </section>

        <section>
          <h2>Step 4: Right hand Melody</h2>
          <p>Add a melody to your waltz. You can use the notes from the C major scale to get you started.</p>
        </section>
      </>
    ),
  },
  {
    id: 'account-setup',
    title: 'Getting Started with KeyCraft',
    meta: 'March 15, 2024 by KeyCraft Team',
    content: (
      <>
        <p>Welcome to KeyCraft! This guide will walk you through creating your KeyCraft account and entering the editor.</p>
        <section>
          <h2>Step 1: Sign Up</h2>
          <p>Press the sign in button in the top right corner of the screen. You will be redirected to a sign up page. Fill out the form!</p>
        </section>
        <section>
          <h2>Step 2: Membership</h2>
          <p>Press the membership tab in the header bar. Choose a plan that suits you and proceed to checkout. You will then have access to Key Craft!</p>
        </section>
        <section>
          <h2>Step 3: Enter Dashboard</h2>
          <p>Click your username in the top right corner. You will be redirected to the dashboard.</p>
        </section>
        <section>
          <h2>Step 4: Launch Editor or Start KeyCraft</h2>
          <p>Click the Launch Editor button and get started with your first composition! As long as you are signed in, the Start KeyCraft button will take you to the editor.</p>
        </section>
      </>
    ),
  },
  {
    id: 'mission',
    title: 'Mission',
    meta: 'March 20, 2024 by KeyCraft Team',
    content: (
      <>
        <p>KeyCraft's mission is to revolutionize the Piano Roll and make it a medium to learn and compose music with an artistic presentation.</p>
        <section>
          <h2>Artform</h2>
          <p>We believe that music creation is an art form that should be accessible to everyone. KeyCraft bridges the gap between traditional music notation and modern digital creation, making it possible for anyone to express themselves musically, regardless of their background or training.</p>
        </section>
        <section>
          <h2>Composition</h2>
          <p>We believe that music creation is an art form that should be accessible to everyone. KeyCraft bridges the gap between traditional music notation and modern digital creation, making it possible for anyone to express themselves musically, regardless of their background or training.</p>
        </section>
        <section>
          <h2>Graphics</h2>
          <p>We're committed to creating a visually stunning and intuitive interface that makes music creation feel natural and engaging. Our piano roll editor features smooth animations, clear visual feedback, and a modern design that works across all devices.</p>
        </section>
        <section>
          <h2>Performance</h2>
          <p>Performance is at the core of our development. We optimize every aspect of KeyCraft to ensure smooth playback, real-time editing, and responsive controls. Our goal is to make the technical aspects invisible, letting you focus purely on your musical creativity.</p>
        </section>
       
      </>
    ),
  },
  {
    id: 'coming-soon',
    title: 'Coming Soon',
    meta: 'March 18, 2024 by KeyCraft Team',
    content: (
      <>
        <p>Future developments by the KeyCraft team.</p>
        <section>
          <h2>Phone App</h2>
          <p>Watch and learn with your piano rolls, smooth scrolling.</p>
        </section>
          <section>
            <h2>Tablet App</h2>
            <p>Kids, Parents and Teachers can use the tablet app to learn music theory and create music together!</p>
          </section>
          <section>
            <h2>Desktop App</h2>
            <p>Full screen experience accesible from your desktop and taskbar.</p>
          </section>

      </>
    ),
  },
];

export default function TutorialsPage() {
  const [selectedPostId, setSelectedPostId] = useState(blogPosts[1].id); // Default to the second post as per original active one

  const handlePostSelect = (postId: string) => {
    setSelectedPostId(postId);
  };

  const selectedPost = blogPosts.find(post => post.id === selectedPostId);

  return (
    <div className="tutorial-container">
      <aside className="sidebar">
        <h2>TUTORIALS & BLOG POSTS</h2>
        <nav>
          <ul>
            {blogPosts.map(post => (
              <li key={post.id}>
                <a 
                  href="#"
                  className={selectedPostId === post.id ? 'active' : ''}
                  onClick={(e) => {
                    e.preventDefault();
                    handlePostSelect(post.id);
                  }}
                >
                  {post.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main className="tutorial-content">
        {selectedPost && (
          <article>
            <h1>{selectedPost.title}</h1>
            <p className="meta">{selectedPost.meta}</p>
            {selectedPost.content}
          </article>
        )}
      </main>
    </div>
  );
} 
