/**
 * Site-wide footer with brand name, copyright, and legal navigation links.
 * Shared across home and results pages for consistent layout.
 */

const FOOTER_LINKS = [
  "Privacy Policy",
  "Terms of Service",
  "Contact",
  "About Us",
];

export default function Footer() {
  return (
    <footer className="flex w-full flex-col items-center justify-between gap-4 bg-surface-container px-5 py-12 md:flex-row md:px-12">
      <div className="flex flex-col items-center gap-4 md:items-start">
        <span className="text-sm font-semibold text-primary">Travora</span>
        <p className="text-xs text-on-surface-variant">
          © 2024 Travora. All rights reserved.
        </p>
      </div>
      <div className="flex gap-8">
        {FOOTER_LINKS.map((link) => (
          <a
            key={link}
            href="#"
            className="text-xs text-on-surface-variant transition-colors hover:text-secondary"
          >
            {link}
          </a>
        ))}
      </div>
    </footer>
  );
}
