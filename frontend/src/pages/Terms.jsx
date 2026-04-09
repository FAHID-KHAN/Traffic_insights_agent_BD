import { FaBalanceScale } from 'react-icons/fa';

export default function Terms() {
  return (
    <div className="legal-page">
      <h2 className="page-title"><FaBalanceScale className="text-cyan" /> Terms of Service &amp; Disclaimer</h2>
      <p className="legal-updated">Last updated: April 2026</p>

      <section className="legal-section">
        <h3>1. Purpose &amp; Nature of Service</h3>
        <p>
          Traffic Insight BD is a <strong>non-commercial, academic and research-oriented</strong> platform.
          It aggregates publicly available road accident reports from Bangladeshi news outlets to
          provide data-driven insights into the national road safety crisis. The platform is intended
          for use by researchers, journalists, policymakers, and the general public.
        </p>
      </section>

      <section className="legal-section">
        <h3>2. Data Sources &amp; Attribution</h3>
        <p>
          Accident data displayed on this platform is sourced from publicly accessible articles on{' '}
          <a href="https://www.newagebd.net" target="_blank" rel="noopener noreferrer">
            <strong>New Age Bangladesh</strong>
          </a> (newagebd.net).
        </p>
        <ul>
          <li>All original content, intellectual property, and copyrights of the news articles
            remain with <strong>New Age Bangladesh</strong> and their respective authors.</li>
          <li>We do <strong>not</strong> reproduce full article text. We extract structured accident
            metadata (dates, locations, casualty counts, vehicle types) for statistical analysis.</li>
          <li>Each data record links back to the original source article for full context.</li>
          <li>Video content is sourced from YouTube and all rights belong to the respective content creators.</li>
        </ul>
      </section>

      <section className="legal-section">
        <h3>3. Fair Use &amp; Legal Basis</h3>
        <p>
          Our use of publicly available news data is grounded in the following principles:
        </p>
        <ul>
          <li><strong>Transformative Use:</strong> We do not republish articles. We extract factual
            data points (locations, dates, casualty numbers) and transform them into statistical
            analyses, visualisations, and trend reports — creating an entirely new work.</li>
          <li><strong>Public Interest:</strong> Road safety is a critical public health concern in
            Bangladesh. This platform serves the public interest by making accident patterns visible
            and accessible.</li>
          <li><strong>Non-Commercial:</strong> This platform generates no revenue, runs no advertising,
            and charges no fees. It is maintained as an open-source project.</li>
          <li><strong>Minimal Data Extraction:</strong> We extract only factual metadata, not
            creative or editorial content. Facts and data are not subject to copyright protection under
            both Bangladeshi law (Copyright Act, 2000) and international norms.</li>
        </ul>
      </section>

      <section className="legal-section">
        <h3>4. Compliance with Bangladesh Law</h3>
        <ul>
          <li><strong>Copyright Act, 2000:</strong> We comply with the Bangladesh Copyright Act by
            limiting our use to factual data extraction and providing proper attribution to the
            original source.</li>
          <li><strong>Digital Security Act, 2018 / Cyber Security Act, 2023:</strong> This platform
            does not store, process, or display any content intended to cause harm, spread
            misinformation, or defame any individual or organisation.</li>
          <li><strong>Right to Information Act, 2009:</strong> Our work aligns with the spirit of
            public access to information for promoting government accountability and road safety
            awareness.</li>
          <li><strong>ICT Act, 2006:</strong> We do not engage in unauthorised access or interference
            with any computer system. We only access publicly available web pages.</li>
        </ul>
      </section>

      <section className="legal-section">
        <h3>5. Respectful Scraping Practices</h3>
        <ul>
          <li>We respect <code>robots.txt</code> directives of the source websites.</li>
          <li>Requests are rate-limited and spaced to avoid placing undue load on source servers.</li>
          <li>Scraping runs on a scheduled interval (not continuous) with configurable frequency.</li>
          <li>If a data source requests removal, we will comply promptly.</li>
        </ul>
      </section>

      <section className="legal-section">
        <h3>6. Disclaimer of Warranties</h3>
        <p>
          This platform is provided <strong>&ldquo;as is&rdquo;</strong> without warranty of any kind.
        </p>
        <ul>
          <li>Data accuracy depends on the source articles. We make best efforts to extract correct
            information using AI and pattern matching, but errors may occur.</li>
          <li>Casualty figures, locations, and accident types are derived programmatically and may
            not be 100% accurate.</li>
          <li>We are not responsible for decisions made based on data from this platform.</li>
          <li>Historical data may be incomplete depending on when scraping was activated.</li>
        </ul>
      </section>

      <section className="legal-section">
        <h3>7. Limitation of Liability</h3>
        <p>
          To the maximum extent permitted by law, the creators and maintainers of Traffic Insight BD
          shall not be liable for any direct, indirect, incidental, or consequential damages arising
          from the use of this platform or reliance on its data.
        </p>
      </section>

      <section className="legal-section">
        <h3>8. Takedown Requests</h3>
        <p>
          If you are a rights holder and believe that any content on this platform infringes your
          intellectual property, please contact us via the LinkedIn profiles in the footer. We will
          review and address any valid takedown request within a reasonable timeframe.
        </p>
      </section>

      <section className="legal-section">
        <h3>9. Open Source</h3>
        <p>
          The source code for this platform is available as an open-source project. Contributions
          and feedback are welcome from the community.
        </p>
      </section>

      <section className="legal-section">
        <h3>10. Changes to These Terms</h3>
        <p>
          We reserve the right to update these terms at any time. Continued use of the platform after
          changes are posted constitutes acceptance of the updated terms.
        </p>
      </section>
    </div>
  );
}
