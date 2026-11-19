"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const slides = [
  { src: "/images/login/municipal-hall.png", label: "Minglanilla Municipal Hall", position: "50% 50%" },
  { src: "/images/login/sports-complex.png", label: "Minglanilla Sports Complex", position: "48% 50%" },
  { src: "/images/login/town-plaza.png", label: "Minglanilla Town Plaza", position: "50% 50%" },
];

export function LoginGallery() {
  const [{ active, previous }, setSlide] = useState({ active: 0, previous: -1 });
  const loaded = useRef(new Set<number>());
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const updateVisibility = () => setVisible(!document.hidden);
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setInterval(() => setSlide((current) => {
      // A delayed or failed image must not stop the whole gallery or reveal an empty slide.
      for (let offset = 1; offset < slides.length; offset++) {
        const next = (current.active + offset) % slides.length;
        if (loaded.current.has(next)) return { previous: current.active, active: next };
      }
      return current;
    }), 5000);
    return () => window.clearInterval(timer);
  }, [visible]);

  return <section className="auth-side auth-gallery" aria-label="Minglanilla community photos" aria-roledescription="carousel">
    <div className="auth-gallery-images" aria-hidden="true">
      {slides.map((slide, index) => <Image key={slide.src} src={slide.src} alt="" fill sizes="(max-width: 760px) 100vw, 46vw" priority={index === 0} loading={index === 0 ? undefined : "eager"} onLoad={() => loaded.current.add(index)} className={`auth-gallery-photo${index === active ? " is-active" : index === previous ? " is-previous" : ""}`} style={{ objectPosition: slide.position }} />)}
    </div>
    <div className="auth-gallery-shade" aria-hidden="true" />
    <div className="auth-gallery-content">
      <div className="auth-gallery-copy"><span className="auth-gallery-kicker">Rooted in our community</span><h2>Minglanilla.<br />Where care begins.</h2><p>Supporting the health workers who know every child, every family, and every community.</p></div>
      <div className="auth-gallery-footer">
        <span className="auth-gallery-caption">{slides[active].label}</span>
      </div>
    </div>
  </section>;
}
