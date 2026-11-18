"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const slides = [
  { src: "/images/login/municipal-hall.png", label: "Minglanilla Municipal Hall", position: "50% 50%" },
  { src: "/images/login/sports-complex.png", label: "Minglanilla Sports Complex", position: "48% 50%" },
  { src: "/images/login/town-plaza.png", label: "Minglanilla Town Plaza", position: "50% 50%" },
];

export function LoginGallery() {
  const [{ active, previous }, setSlide] = useState({ active: 0, previous: -1 });
  const [loaded, setLoaded] = useState<number[]>([]);
  const [visible, setVisible] = useState(true);
  const ready = loaded.length === slides.length;

  useEffect(() => {
    const updateVisibility = () => setVisible(!document.hidden);
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (!ready || !visible) return;
    const timer = window.setInterval(() => setSlide((current) => ({ previous: current.active, active: (current.active + 1) % slides.length })), 5000);
    return () => window.clearInterval(timer);
  }, [ready, visible]);

  return <section className="auth-side auth-gallery" aria-label="Minglanilla community photos" aria-roledescription="carousel">
    <div className="auth-gallery-images" aria-hidden="true">
      {slides.map((slide, index) => <Image key={slide.src} src={slide.src} alt="" fill sizes="(max-width: 760px) 100vw, 46vw" priority={index === 0} loading={index === 0 ? undefined : "eager"} onLoad={() => setLoaded((current) => current.includes(index) ? current : [...current, index])} className={`auth-gallery-photo${index === active ? " is-active" : index === previous ? " is-previous" : ""}`} style={{ objectPosition: slide.position }} />)}
    </div>
    <div className="auth-gallery-shade" aria-hidden="true" />
    <div className="auth-gallery-content">
      <div className="auth-gallery-copy"><span className="auth-gallery-kicker">Serving Minglanilla</span><h2>Care, organized by community.</h2><p>One shared place for child records, barangay assignments, and clear monthly age reporting.</p></div>
      <div className="auth-gallery-footer">
        <span className="auth-gallery-caption">{slides[active].label}</span>
      </div>
    </div>
  </section>;
}
