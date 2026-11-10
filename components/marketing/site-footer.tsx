/**
 * SiteFooter — shared footer rendered by the root layout on every page.
 *
 * Carries its own ThemeScript so it follows the same light/dark choice as
 * the marketing surface without needing a `.dark` ancestor. Links are
 * grouped: product, ecosystem, resources, legal.
 */

import Link from 'next/link';
import { Mail } from 'lucide-react';
import { GithubIcon } from '@/components/icons/github';
import { ThemeScript } from './theme-script';

export const GITHUB_URL = 'https://github.com/esoken92/VMS-Demo-V0';
const LICENSE_URL = 'https://creativecommons.org/licenses/by-nc-sa/4.0/';
const ESO_URL = 'https://esoind.co.za';
const TYRESYNC_URL = 'https://tyresync.co.za';
const CONTACT_EMAIL = 'esoken92@gmail.com';

const productLinks = [
  { label: 'Live demo', href: '/dashboard' },
  { label: 'Sign in', href: '/auth/login' },
  { label: 'Create account', href: '/auth/signup' },
];

const ecosystemLinks = [
  { label: 'ESO Industries', href: ESO_URL },
  { label: 'TyreSync', href: TYRESYNC_URL },
];

const resourceLinks = [
  { label: 'GitHub repository', href: GITHUB_URL },
  { label: 'Architecture notes', href: `${GITHUB_URL}/blob/main/docs/ARCHITECTURE.md` },
  { label: 'Integrations guide', href: `${GITHUB_URL}/blob/main/docs/INTEGRATIONS.md` },
  { label: 'Request → UI logic chain', href: `${GITHUB_URL}/blob/main/docs/LOGIC_CHAIN.md` },
];

const legalLinks = [
  { label: 'CC BY-NC-SA 4.0 license', href: LICENSE_URL },
  { label: 'Contact the maintainer', href: `mailto:${CONTACT_EMAIL}` },
];

function FooterLink({
  href,
  children,
  external,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const className =
    'text-sm text-muted-foreground transition-colors hover:text-foreground';
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer
      id="vms-site-footer"
      suppressHydrationWarning
      className="border-t border-border bg-card text-card-foreground"
    >
      <ThemeScript targetId="vms-site-footer" />
      <div className="container py-10">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2">
            <Link href="/" className="inline-flex items-center gap-2">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
              >
                V
              </span>
              <span className="text-lg font-bold tracking-tight">VMS</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Inventory management that respects the people doing the work.
              Free, open-source, self-hosted.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="VMS on GitHub"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <GithubIcon className="h-5 w-5" aria-hidden="true" />
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                aria-label="Email the maintainer"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <Mail className="h-5 w-5" aria-hidden="true" />
              </a>
            </div>
          </div>

          <nav aria-label="Product">
            <h2 className="text-sm font-semibold">Product</h2>
            <ul className="mt-3 space-y-2">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <FooterLink href={link.href}>{link.label}</FooterLink>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Ecosystem and resources">
            <h2 className="text-sm font-semibold">Ecosystem</h2>
            <ul className="mt-3 space-y-2">
              {ecosystemLinks.map((link) => (
                <li key={link.label}>
                  <FooterLink href={link.href} external>
                    {link.label}
                  </FooterLink>
                </li>
              ))}
            </ul>
            <h2 className="mt-6 text-sm font-semibold">Resources</h2>
            <ul className="mt-3 space-y-2">
              {resourceLinks.map((link) => (
                <li key={link.label}>
                  <FooterLink href={link.href} external={link.href.startsWith('http')}>
                    {link.label}
                  </FooterLink>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Legal">
            <h2 className="text-sm font-semibold">Legal</h2>
            <ul className="mt-3 space-y-2">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <FooterLink href={link.href} external={link.href.includes(':')}>
                    {link.label}
                  </FooterLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>
            Part of the{' '}
            <a
              href={ESO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:underline"
            >
              ESO Industries
            </a>{' '}
            ecosystem ·{' '}
            <a
              href={TYRESYNC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground hover:underline"
            >
              tyresync.co.za
            </a>
          </p>
          <p>
            © {year} ESO Industries ·{' '}
            <a
              href={LICENSE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground hover:underline"
            >
              CC BY-NC-SA 4.0
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
