import { FaShieldAlt } from 'react-icons/fa';

export default function Privacy() {
  return (
    <div className="legal-page">
      <h2 className="page-title"><FaShieldAlt className="text-cyan" /> Privacy Policy</h2>
      <p className="legal-updated">Last updated: April 2026</p>

      <section className="legal-section">
        <h3>1. Introduction</h3>
        <p>
          Traffic Insight BD (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;the platform&rdquo;) is a
          non-commercial, research-oriented project that aggregates publicly available road accident
          reports from Bangladeshi news sources. This Privacy Policy explains how we handle information
          when you visit our website.
        </p>
      </section>

      <section className="legal-section">
        <h3>2. Information We Collect</h3>
        <h4>2.1 Data We Do <em>Not</em> Collect</h4>
        <ul>
          <li>We do <strong>not</strong> require user registration or accounts.</li>
          <li>We do <strong>not</strong> collect personal information such as names, email addresses, or phone numbers.</li>
          <li>We do <strong>not</strong> use third-party advertising or tracking services.</li>
          <li>We do <strong>not</strong> sell, rent, or share any data with third parties.</li>
        </ul>
        <h4>2.2 Automatically Collected Data</h4>
        <ul>
          <li><strong>Server Logs:</strong> Standard web server logs may record IP addresses, browser type,
            and access timestamps for security and debugging purposes. These logs are not used
            for tracking or profiling.</li>
          <li><strong>Local Storage:</strong> We use your browser&apos;s local storage to save your
            theme preference (dark/light mode). This data stays on your device and is never transmitted
            to our servers.</li>
        </ul>
      </section>

      <section className="legal-section">
        <h3>3. Cookies</h3>
        <p>
          This website does <strong>not</strong> set any first-party or third-party cookies for
          tracking purposes. If you use the embedded YouTube video player, YouTube may set cookies
          governed by <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google&apos;s Privacy Policy</a>.
        </p>
      </section>

      <section className="legal-section">
        <h3>4. Third-Party Services</h3>
        <ul>
          <li><strong>YouTube Embeds:</strong> Video news coverage is displayed via YouTube embeds.
            Playback is governed by YouTube&apos;s <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>.</li>
          <li><strong>OpenStreetMap / CARTO Tiles:</strong> Map tiles are loaded from third-party tile
            servers. These requests are subject to their respective privacy policies.</li>
        </ul>
      </section>

      <section className="legal-section">
        <h3>5. Data Security</h3>
        <p>
          We implement industry-standard security headers (Content Security Policy, HSTS,
          X-Content-Type-Options, X-Frame-Options) and parameterised database queries to protect
          against common web vulnerabilities. However, no system is 100% secure.
        </p>
      </section>

      <section className="legal-section">
        <h3>6. Children&apos;s Privacy</h3>
        <p>
          This platform is not directed at children under 13. We do not knowingly collect any
          personal information from children.
        </p>
      </section>

      <section className="legal-section">
        <h3>7. Changes to This Policy</h3>
        <p>
          We may update this Privacy Policy from time to time. Changes will be reflected on this page
          with an updated &ldquo;Last updated&rdquo; date.
        </p>
      </section>

      <section className="legal-section">
        <h3>8. Contact</h3>
        <p>
          If you have questions about this Privacy Policy, please reach out to the project
          maintainers via the LinkedIn profiles linked in the website footer.
        </p>
      </section>
    </div>
  );
}
