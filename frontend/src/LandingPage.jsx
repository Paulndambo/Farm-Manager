import { useEffect, useState } from "react";
import {
  BarChart3,
  Check,
  ChevronRight,
  Cloud,
  DollarSign,
  HeartPulse,
  Leaf,
  Lock,
  Menu,
  PawPrint,
  Receipt,
  Scale,
  ShieldCheck,
  Smartphone,
  Syringe,
  TrendingUp,
  Users,
  Wheat,
  X,
} from "lucide-react";
import "./LandingPage.css";

const navLinks = [
  ["Features", "#features"],
  ["How it works", "#how-it-works"],
  ["Livestock", "#livestock"],
  ["Finances", "#finances"],
  ["Testimonials", "#testimonials"],
];

const counties = ["Kiambu County", "Nakuru", "Nyandarua", "Meru", "Laikipia", "Narok", "Bomet"];

const features = [
  {
    icon: PawPrint,
    tone: "green",
    title: "Livestock Register",
    tag: "Core feature",
    text: "A permanent, searchable record for every animal. Ear tag ID, breed, age, sex, weight, location, origin, and health status all in one profile.",
  },
  {
    icon: Syringe,
    tone: "rust",
    title: "Vaccination Tracking",
    tag: "Health and compliance",
    text: "Log every shot, record the batch number, set the next due date, and get overdue alerts before animals fall behind on their schedule.",
  },
  {
    icon: TrendingUp,
    tone: "gold",
    title: "Growth Monitoring",
    tag: "Performance",
    text: "Record regular weigh-ins with body condition scores. Watch individual growth curves over time and spot underperformers early.",
  },
  {
    icon: HeartPulse,
    tone: "green",
    title: "Health Event Log",
    tag: "Health and welfare",
    text: "Track illnesses, injuries, observations, and treatments per animal. Flag open issues and mark cases resolved when they close.",
  },
  {
    icon: Wheat,
    tone: "gold",
    title: "Feed Inventory",
    tag: "Inventory",
    text: "Monitor stock levels for every feed type with low-stock alerts. Log restocks and usage, track cost per kilogram, and manage suppliers.",
  },
  {
    icon: DollarSign,
    tone: "green",
    title: "Farm Finances",
    tag: "Finance",
    text: "Record revenue from animal sales, milk, eggs, and produce. Track every cost and see profit and loss by month and category.",
  },
];

const includedFeatures = [
  ["green", PawPrint, "Unlimited animal records", "No caps on how many animals you register. Add cattle, goats, sheep, pigs, chickens, horses, and other species in one system."],
  ["rust", Syringe, "Vaccination scheduler", "Set due dates and receive overdue alerts automatically. Batch number and administering vet are recorded per dose."],
  ["gold", Scale, "Weight and growth charts", "Plot individual animal growth curves over time with body condition scoring and gain-per-period calculation."],
  ["green", HeartPulse, "Health event log", "Track illnesses, injuries, treatments, and vet visits per animal. Open issues are flagged clearly across the dashboard."],
  ["gold", Wheat, "Feed stock management", "Track inventory levels per feed type, set reorder alerts, record restocks and daily usage."],
  ["green", DollarSign, "Sales revenue tracking", "Record animal sales, milk, eggs, wool, and other produce. Link sales to specific animals for a complete income picture."],
  ["rust", Receipt, "Expense management", "Log costs by category. Purchased animals and restocked feed are auto-logged so there is no double entry."],
  ["gold", BarChart3, "Profit and loss dashboard", "Monthly revenue vs expenses chart, profit margin tracking, and breakdowns by revenue type and expense category."],
  ["green", Users, "Team management", "Add farm managers and workers with role-based access. Admins control who can see and do what."],
  ["rust", Smartphone, "Works on any device", "Fully mobile-responsive. Use it in the field on your phone or at the desk on a laptop."],
  ["gold", Lock, "Farm-scoped access", "Owners create a farm workspace, then admins add users who only see that farm's data."],
  ["green", Cloud, "Data persists automatically", "Everything saves as you go. Your records are there every time you come back."],
];

const testimonials = [
  {
    initials: "JM",
    tone: "green",
    name: "James Mwangi",
    role: "Dairy farmer - Kiambu",
    quote:
      "Before this, I had three different notebooks for vaccinations, weights, and expenses. Now everything is in one place and I can actually see if the farm is profitable.",
  },
  {
    initials: "AK",
    tone: "rust",
    name: "Agnes Kamau",
    role: "Mixed livestock - Nakuru",
    quote:
      "The vaccination overdue alerts alone have saved me from so many problems. I used to miss due dates. Now the system tells me before anything lapses.",
  },
  {
    initials: "PO",
    tone: "gold",
    name: "Patrick Otieno",
    role: "Beef farmer - Laikipia",
    quote:
      "I gave access to my farm manager so I can check the records from the city. Team management means he can update everything and I can review it remotely.",
  },
];

function BrandMark() {
  return (
    <span className="lp-brand-mark" aria-hidden="true">
      <Leaf size={20} strokeWidth={2.4} />
    </span>
  );
}

function Tag({ children, tone = "green" }) {
  return <span className={`lp-tag lp-tag--${tone}`}>{children}</span>;
}

function EarTag({ children }) {
  return (
    <span className="lp-ear-tag">
      <span className="lp-ear-tag__hole" />
      {children}
    </span>
  );
}

function MockDashboard() {
  const chartBars = [40, 55, 45, 70, 60, 85, 90];

  return (
    <div className="lp-hero-stack">
      <div className="lp-floating-badge lp-floating-badge--top">
        <span className="lp-floating-badge__icon lp-floating-badge__icon--green">
          <Check size={17} />
        </span>
        <span>
          <strong>3 vaccines due</strong>
          <small>Review now</small>
        </span>
      </div>

      <div className="lp-mock-app">
        <div className="lp-mock-topbar">
          <strong>Pasture Ledger</strong>
          <span>FA</span>
        </div>
        <div className="lp-mock-body">
          <div className="lp-mock-stats">
            <div><strong>24</strong><span>Animals</span></div>
            <div><strong className="lp-rust-text">2</strong><span>Sick</span></div>
            <div><strong className="lp-gold-text">3</strong><span>Vax due</span></div>
            <div><strong className="lp-green-text">+12%</strong><span>Profit</span></div>
          </div>

          <div className="lp-mock-panels">
            <div className="lp-mock-panel">
              <h4>Herd status</h4>
              <p><span className="lp-dot lp-dot--green" />Healthy - 19</p>
              <p><span className="lp-dot lp-dot--gold" />Pregnant - 3</p>
              <p><span className="lp-dot lp-dot--rust" />Sick - 2</p>
            </div>
            <div className="lp-mock-panel">
              <h4>Revenue trend</h4>
              <div className="lp-mini-chart" aria-hidden="true">
                {chartBars.map((height, index) => (
                  <span
                    key={height + index}
                    className={index === chartBars.length - 1 ? "lp-mini-chart__bar lp-mini-chart__bar--rust" : "lp-mini-chart__bar"}
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="lp-mock-table">
            <div className="lp-mock-table__head">
              <span>Tag</span><span>Name</span><span>Species</span><span>Status</span><span>Weight</span>
            </div>
            {[
              ["CT-014", "Bramble", "Cattle", "Healthy", "328 kg", "green"],
              ["PG-007", "Wilbur", "Pig", "Sick", "71 kg", "rust"],
              ["GT-002", "Pepper", "Goat", "Pregnant", "38 kg", "gold"],
            ].map(([tag, name, species, status, weight, tone]) => (
              <div className="lp-mock-table__row" key={tag}>
                <span><EarTag>{tag}</EarTag></span>
                <span>{name}</span>
                <span>{species}</span>
                <span><span className={`lp-status lp-status--${tone}`}>{status}</span></span>
                <span>{weight}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="lp-floating-badge lp-floating-badge--bottom">
        <span className="lp-floating-badge__icon lp-floating-badge__icon--gold">
          <DollarSign size={17} />
        </span>
        <span>
          <strong>Net profit: +62K</strong>
          <small>This month</small>
        </span>
      </div>
    </div>
  );
}

function LivestockMock() {
  return (
    <div className="lp-deep-card">
      <div className="lp-animal-head">
        <EarTag>CT-014</EarTag>
        <div>
          <strong>Bramble</strong>
          <span>Jersey Cattle - Female</span>
        </div>
        <span className="lp-status lp-status--green">Healthy</span>
      </div>

      <div className="lp-animal-stats">
        {[
          ["Age", "3y 4mo"],
          ["Weight", "328 kg"],
          ["Location", "North Paddock"],
          ["Origin", "Born in herd"],
          ["Vaccines", "3 on record"],
          ["Health issues", "None open"],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="lp-weight-card">
        <h4>Weight over time</h4>
        <div className="lp-weight-bars">
          {[52, 64, 72, 80, 100].map((height, index) => (
            <div key={height}>
              <span style={{ height: `${height}%` }} />
              <small>{["Jan", "Feb", "Mar", "Apr", "May"][index]}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="lp-health-list">
        <h4>Recent health events</h4>
        <div>
          <span className="lp-health-icon lp-health-icon--green"><Check size={15} /></span>
          <p><strong>Minor wire cut on left flank</strong><small>Resolved - 40 days ago - Iodine wash applied</small></p>
        </div>
        <div>
          <span className="lp-health-icon lp-health-icon--gold"><ShieldCheck size={15} /></span>
          <p><strong>Routine observation - coat condition</strong><small>Open - Dr. Wanjiru - Follow-up in 7 days</small></p>
        </div>
      </div>
    </div>
  );
}

function FinanceMock() {
  return (
    <div className="lp-deep-card">
      <div className="lp-fin-kpis">
        <div><strong className="lp-green-text">132K</strong><span>Revenue</span></div>
        <div><strong className="lp-rust-text">69K</strong><span>Expenses</span></div>
        <div><strong className="lp-green-text">+63K</strong><span>Net profit</span></div>
      </div>
      <div className="lp-month-strip">
        <div><span>This month revenue</span><strong>+24,075</strong></div>
        <div><span>This month expenses</span><strong className="lp-month-strip__loss">-10,300</strong></div>
        <div><span>Net</span><strong>+13,775</strong></div>
      </div>
      <BarGroup
        title="Revenue by type"
        rows={[
          ["Animal", "95,200", 72, "green"],
          ["Milk", "23,075", 25, "gold"],
          ["Other", "13,725", 10, "muted"],
        ]}
      />
      <BarGroup
        title="Expenses by category"
        rows={[
          ["Feed", "41,280", 60, "rust"],
          ["Vet", "14,300", 22, "clay"],
          ["Labor", "13,420", 18, "muted"],
        ]}
      />
    </div>
  );
}

function BarGroup({ title, rows }) {
  return (
    <div className="lp-bar-group">
      <h4>{title}</h4>
      {rows.map(([label, value, width, tone]) => (
        <div className="lp-bar-row" key={label}>
          <span>{label}</span>
          <div><i className={`lp-bar-fill lp-bar-fill--${tone}`} style={{ width: `${width}%` }} /></div>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function LandingPage({ onEnterApp }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll);

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach((entry, index) => {
          if (entry.isIntersecting) {
            setTimeout(() => entry.target.classList.add("is-visible"), index * 70);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );

    document.querySelectorAll(".lp-fade-up").forEach(element => observer.observe(element));

    return () => {
      window.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, []);

  const enterApp = event => {
    event.preventDefault();
    onEnterApp();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="landing-page">
      <nav className={`lp-nav ${scrolled ? "is-scrolled" : ""}`}>
        <div className="lp-nav__inner">
          <a className="lp-logo" href="#top" onClick={closeMenu}>
            <BrandMark />
            <span>Pasture Ledger</span>
          </a>
          <ul className="lp-nav__links">
            {navLinks.map(([label, href]) => (
              <li key={href}><a href={href}>{label}</a></li>
            ))}
          </ul>
          <div className="lp-nav__actions">
            <a className="lp-btn lp-btn--nav-signin" href="#app" onClick={enterApp}>Sign in</a>
            <a className="lp-btn lp-btn--primary" href="#app" onClick={enterApp}>Get started</a>
            <button className="lp-menu-button" type="button" onClick={() => setMenuOpen(open => !open)} aria-label="Open menu">
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      <div className={`lp-mobile-menu ${menuOpen ? "is-open" : ""}`}>
        <div className="lp-mobile-menu__links">
          {navLinks.map(([label, href]) => (
            <a key={href} href={href} onClick={closeMenu}>{label}<ChevronRight size={16} /></a>
          ))}
        </div>
        <div className="lp-mobile-menu__actions">
          <a className="lp-btn lp-btn--outline" href="#app" onClick={enterApp}>Sign in</a>
          <a className="lp-btn lp-btn--primary" href="#app" onClick={enterApp}>Get started free</a>
        </div>
      </div>
      {menuOpen && <button className="lp-mobile-backdrop" type="button" aria-label="Close menu" onClick={closeMenu} />}

      <main id="top">
        <section className="lp-hero">
          <div className="lp-container lp-hero__grid">
            <div className="lp-hero__content">
              <Tag tone="dark">Built for working farms</Tag>
              <h1>Run your farm with <em>total clarity</em></h1>
              <p>
                Pasture Ledger brings your livestock records, health history, feed inventory, vaccinations, and farm finances
                into one clean, simple platform accessible from the field or the office.
              </p>
              <div className="lp-hero__ctas">
                <a className="lp-btn lp-btn--primary lp-btn--large" href="#app" onClick={enterApp}>Start for free <ChevronRight size={18} /></a>
                <a className="lp-btn lp-btn--ghost lp-btn--large" href="#how-it-works">See how it works</a>
              </div>
              <div className="lp-hero__metrics">
                <div><strong>100%</strong><span>Browser-based</span></div>
                <div><strong>5 min</strong><span>To get started</span></div>
                <div><strong>All sizes</strong><span>From 5 to millions of animals</span></div>
              </div>
            </div>
            <div className="lp-hero__visual">
              <MockDashboard />
            </div>
          </div>
        </section>

        <section className="lp-trust-strip" aria-label="Trusted by farms across Kenya">
          <div className="lp-trust-strip__inner">
            <span>Trusted by farms across</span>
            <i aria-hidden="true" />
            {counties.map(county => <strong key={county}>{county}</strong>)}
          </div>
        </section>

        <section className="lp-section" id="features">
          <div className="lp-container">
            <div className="lp-section-header lp-fade-up">
              <Tag>Everything you need</Tag>
              <h2>One platform for every part of your farm</h2>
              <p>From a single goat to a herd of hundreds, Pasture Ledger scales with you and keeps every record at your fingertips.</p>
            </div>
            <div className="lp-features-grid">
              {features.map(({ icon: Icon, tone, title, tag, text }) => (
                <article className="lp-feature-card lp-fade-up" key={title}>
                  <span className={`lp-feature-icon lp-feature-icon--${tone}`}><Icon size={24} /></span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  <Tag tone={tone}>{tag}</Tag>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-how-section" id="how-it-works">
          <div className="lp-container">
            <div className="lp-section-header lp-fade-up">
              <Tag tone="dark">Simple by design</Tag>
              <h2>Up and running in minutes</h2>
              <p>No training courses or IT team needed. If you can use a phone, you can use Pasture Ledger.</p>
            </div>
            <div className="lp-steps">
              {[
                ["1", "Create your account", "Sign up and add your farm's name. Your admin account is ready instantly, then you can invite managers and workers."],
                ["2", "Add your livestock", "Register each animal with tag ID, species, breed, sex, date of birth, and origin."],
                ["3", "Run your farm smarter", "Record weigh-ins, vaccinations, health issues, sales, and costs while the dashboard keeps the operation clear."],
              ].map(([number, title, text]) => (
                <article className="lp-step lp-fade-up" key={number}>
                  <span>{number}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-deep-section" id="livestock">
          <div className="lp-container lp-deep-grid">
            <div className="lp-deep-copy lp-fade-up">
              <Tag>Livestock management</Tag>
              <h2>Every animal's full story, one tap away</h2>
              <p>Click any animal in the register to open a detailed profile showing growth history, vaccination records, open health issues, and purchase cost.</p>
              <ul>
                <li>Filter and search across your entire herd by species, status, or location</li>
                <li>Track whether animals were born in the herd or purchased, with acquisition cost</li>
                <li>See open health issues flagged directly on the animal list</li>
                <li>Review body condition scores alongside every weigh-in</li>
                <li>Open a tabbed drawer with overview, growth, vaccinations, and health in one view</li>
              </ul>
            </div>
            <div className="lp-fade-up">
              <LivestockMock />
            </div>
          </div>
        </section>

        <section className="lp-deep-section lp-deep-section--paper" id="finances">
          <div className="lp-container lp-deep-grid lp-deep-grid--reverse">
            <div className="lp-deep-copy lp-fade-up">
              <Tag tone="gold">Farm finances</Tag>
              <h2>Know exactly where you stand every single day</h2>
              <p>Pasture Ledger tracks every shilling in and out, from animal sales and produce revenue to feed, vet bills, labor, and equipment costs.</p>
              <ul>
                <li>Monthly revenue vs expenses bar chart for fast trend spotting</li>
                <li>Auto-logs expenses when you add purchased animals or restock feed</li>
                <li>Revenue broken down by sale type: animal, milk, eggs, and produce</li>
                <li>Expenses grouped by category: vet, labor, feed, transport, and equipment</li>
                <li>Net profit or loss with profit margin percentage</li>
              </ul>
            </div>
            <div className="lp-fade-up">
              <FinanceMock />
            </div>
          </div>
        </section>

        <section className="lp-full-features">
          <div className="lp-container">
            <div className="lp-section-header lp-section-header--left lp-fade-up">
              <Tag>Full feature list</Tag>
              <h2>Everything that's included</h2>
            </div>
            <div className="lp-full-features__grid">
              {includedFeatures.map(([tone, Icon, title, text]) => (
                <article className="lp-full-feature lp-fade-up" key={title}>
                  <span className={`lp-full-feature__icon lp-full-feature__icon--${tone}`}><Icon size={19} /></span>
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-testimonials" id="testimonials">
          <div className="lp-container">
            <div className="lp-section-header lp-fade-up">
              <Tag tone="gold">From the field</Tag>
              <h2>Farmers who've made the switch</h2>
              <p>Real feedback from farm owners using Pasture Ledger to run their operations.</p>
            </div>
            <div className="lp-testimonials__grid">
              {testimonials.map(testimonial => (
                <article className="lp-testimonial lp-fade-up" key={testimonial.name}>
                  <div className="lp-stars">*****</div>
                  <blockquote>{testimonial.quote}</blockquote>
                  <cite>
                    <span className={`lp-avatar lp-avatar--${testimonial.tone}`}>{testimonial.initials}</span>
                    <span><strong>{testimonial.name}</strong><small>{testimonial.role}</small></span>
                  </cite>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-cta" id="cta">
          <div className="lp-cta__inner lp-fade-up">
            <Tag tone="dark">Get started today</Tag>
            <h2>Your farm deserves better records</h2>
            <p>Stop managing animals in spreadsheets and notebooks. Pasture Ledger gives you a complete picture of your herd and your finances in one place, on any device.</p>
            <div className="lp-cta__buttons">
              <a className="lp-btn lp-btn--primary lp-btn--large" href="#app" onClick={enterApp}>Create your account <ChevronRight size={18} /></a>
              <a className="lp-btn lp-btn--ghost lp-btn--large" href="#features">Explore features</a>
            </div>
            <small>No credit card needed - Takes 5 minutes to set up - Works on mobile</small>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-footer__grid">
          <div>
            <a className="lp-logo" href="#top">
              <BrandMark />
              <span>Pasture Ledger</span>
            </a>
            <p>A complete farm management platform for livestock farmers who want clarity over herd health, operations, and finances.</p>
          </div>
          <FooterLinks title="Product" links={["Features", "How it works", "Livestock", "Finances", "Get started"]} />
          <FooterLinks title="Features" links={["Animal register", "Vaccinations", "Growth tracking", "Health events", "Feed inventory", "Farm finances"]} />
          <FooterLinks title="Company" links={["About us", "Contact", "Privacy policy", "Terms of use", "Support"]} />
        </div>
        <div className="lp-footer__bottom">
          <p>© 2026 Pasture Ledger. All rights reserved.</p>
          <span><a href="#top">Privacy</a><a href="#top">Terms</a><a href="#top">Cookies</a></span>
        </div>
      </footer>
    </div>
  );
}

function FooterLinks({ title, links }) {
  return (
    <div className="lp-footer__col">
      <h3>{title}</h3>
      <ul>
        {links.map(link => <li key={link}><a href="#top">{link}</a></li>)}
      </ul>
    </div>
  );
}

export default LandingPage;
