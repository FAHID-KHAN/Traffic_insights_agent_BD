import { FaLinkedin, FaRobot, FaNewspaper, FaMapMarkerAlt, FaProjectDiagram, FaChartLine, FaBrain, FaUsers, FaBullseye, FaLightbulb } from 'react-icons/fa';

const features = [
  {
    icon: <FaNewspaper />,
    title: 'Automated News Scanning',
    desc: 'A custom scanner continuously monitors leading Bangladeshi newspapers, collecting road accident reports around the clock without manual effort.',
  },
  {
    icon: <FaBrain />,
    title: 'AI-Powered Smart Extraction',
    desc: 'Each article is fed through AI models which parse unstructured Bangla and English text into structured records — extracting casualties, vehicle types, locations, and causes with high accuracy.',
  },
  {
    icon: <FaMapMarkerAlt />,
    title: 'Geo Intelligence',
    desc: 'AI normalizes location mentions to one of Bangladesh\'s 64 districts, maps them to the correct division, and assigns geographic coordinates for precise map visualizations.',
  },
  {
    icon: <FaProjectDiagram />,
    title: 'Cluster & Blackspot Detection',
    desc: 'Pattern recognition algorithms identify accident clusters — areas where incidents concentrate over short time windows — and flag emerging danger zones before they escalate.',
  },
  {
    icon: <FaChartLine />,
    title: 'Trend Forecasting',
    desc: 'Statistical models analyze historical patterns to forecast monthly casualty trends, helping policymakers anticipate and prepare for high-risk periods.',
  },
  {
    icon: <FaRobot />,
    title: 'Intelligent Data Validation',
    desc: 'Every AI-extracted record passes through strict schema validation, duplicate detection, and sanity checks before entering the database — ensuring data integrity at scale.',
  },
];

const creators = [
  {
    name: 'Rafeed Chowdhury',
    role: 'AI Software Developer',
    bio: 'Rafeed has developed the llm pipeline and scanning architecture behind Traffic Insight BD\'s AI extraction pipeline. With a deep interest in applied machine learning and LLM, he designed the system that turns raw news text into structured, actionable safety data. He believes that AI should serve real-world problems — and road safety in Bangladesh is one that demands attention.',
    linkedin: 'https://www.linkedin.com/in/rafeedcse94/',
  },
  {
    name: 'Fahid Khan',
    role: 'Software Engineer',
    bio: 'Fahid brings the platform to life through its interactive frontend and robust backend infrastructure. His focus on clean architecture and user experience ensures that complex data is presented in a way anyone — from researchers to journalists — can understand and act on.',
    linkedin: 'https://www.linkedin.com/in/fahid-a-khan-46758819b/',
  },
];

export default function About() {
  return (
    <div className="about-page">
      {/* Hero */}
      <section className="about-hero">
        <span className="section-label">About Us</span>
        <h2 className="page-title"><FaBullseye className="text-green" /> Our Mission</h2>
        <p className="about-hero-text">
          Bangladesh loses thousands of lives to road accidents every year, yet comprehensive,
          real-time data remains scarce. <strong>Traffic Insight BD</strong> was built to change that —
          we harness artificial intelligence to transform scattered newspaper reports into a
          structured, searchable intelligence platform that empowers researchers, journalists,
          and policymakers to understand the crisis and drive change.
        </p>
        <p className="about-hero-text">
          <em>Because every life on the road matters — better data for a safer Bangladesh.</em>
        </p>
      </section>

      {/* AI Features */}
      <section className="about-section">
        <span className="section-label">AI-Powered</span>
        <h3 className="about-section-title"><FaBrain className="text-green" /> What Makes Us Different</h3>
        <div className="about-features-grid">
          {features.map((f) => (
            <div className="about-feature-card" key={f.title}>
              <div className="about-feature-icon">{f.icon}</div>
              <h4>{f.title}</h4>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why We Built This */}
      <section className="about-section">
        <span className="section-label">The Story</span>
        <h3 className="about-section-title"><FaLightbulb className="text-cyan" /> Why We Built This</h3>
        <div className="about-story-card">
          <p>
            Road accidents are one of the leading causes of death in Bangladesh, claiming over
            7,000 lives annually according to official estimates — a number many experts believe
            is far higher in reality. Despite the scale of this crisis, there was no centralized,
            structured database tracking these incidents in real time.
          </p>
          <p>
            News reports existed, scattered across dozens of outlets in Bangla and English, but the
            information locked inside them was inaccessible at scale. Researchers had to manually
            read and record data from articles. Policymakers lacked the evidence base to target
            interventions effectively. Journalists couldn't easily identify patterns or emerging
            hotspots.
          </p>
          <p>
            We asked a simple question: <strong>what if AI could read every accident report published
            in Bangladesh and turn it into structured, searchable intelligence — automatically?</strong>
          </p>
          <p>
            That question became Traffic Insight BD. What started as a weekend experiment with web
            scanning and GPT quickly grew into a full-fledged platform — one that we believe can
            contribute to saving lives by making road safety data visible, accessible, and actionable.
          </p>
        </div>
      </section>

      {/* Creators */}
      <section className="about-section">
        <span className="section-label">Team</span>
        <h3 className="about-section-title"><FaUsers className="text-green" /> The Creators</h3>
        <p className="about-team-intro">
          The engineers behind Traffic Insight BD — driven by a shared commitment to using technology for public safety and social impact.
        </p>
        <div className="about-creators-grid">
          {creators.map((c) => (
            <div className="about-creator-card" key={c.name}>
              <div className="about-creator-info">
                <h4>{c.name}</h4>
                <span className="about-creator-role">{c.role}</span>
                <p className="about-creator-bio">{c.bio}</p>
              </div>
              <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className="about-creator-link">
                <FaLinkedin /> Connect on LinkedIn
              </a>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
