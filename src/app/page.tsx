import { RNAEditor } from "@/components/RNAEditor";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">RNA Layout Tool</p>
          <h1>Directly shape RNA figures on the canvas.</h1>
        </div>
        <p className="hero-copy">
          Start from a scaffold, drag every position into place, add or delete points on the
          canvas, and export clean SVG or PNG for figures.
        </p>
      </section>
      <RNAEditor />
    </main>
  );
}
