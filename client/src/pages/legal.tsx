import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { FileText, ShieldCheck, ScrollText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

type LegalPageConfig = {
  title: string | null;
  body: string | null;
  heroImageUrl: string | null;
  updatedAt: string;
} | null;

const LEGAL_DEFS: Record<string, {
  icon: typeof FileText;
  defaultTitle: string;
  defaultBody: string;
}> = {
  terms: {
    icon: ScrollText,
    defaultTitle: "Terms & Conditions",
    defaultBody: `These Terms and Conditions govern your use of Sweet Momentum and constitute a legally binding agreement between you and Sweet Momentum.

By accessing or using Sweet Momentum, you agree to be bound by these Terms. If you do not agree, please do not use the app.

USE OF THE SERVICE
You may use Sweet Momentum for your personal, non-commercial use. You agree not to misuse the service or help anyone else do so.

ACCOUNTS
You are responsible for maintaining the confidentiality of your account credentials. You are responsible for all activity that occurs under your account.

SUBSCRIPTION AND BILLING
Sweet Momentum offers free and paid subscription tiers. Paid subscriptions are billed in advance and are non-refundable except as required by law.

INTELLECTUAL PROPERTY
All content, features, and functionality of Sweet Momentum are the exclusive property of Sweet Momentum and its licensors.

LIMITATION OF LIABILITY
Sweet Momentum is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages.

CHANGES TO TERMS
We reserve the right to modify these Terms at any time. Continued use of the service after changes constitutes acceptance of the new Terms.

CONTACT
For questions about these Terms, please contact us at track@sweetmo.io.`,
  },
  privacy: {
    icon: ShieldCheck,
    defaultTitle: "Privacy Policy",
    defaultBody: `This Privacy Policy describes how Sweet Momentum collects, uses, and protects your personal information.

INFORMATION WE COLLECT
We collect information you provide directly, such as your name, email address, and performance data you enter into the app. We also collect usage data to improve our service.

HOW WE USE YOUR INFORMATION
We use your information to provide and improve the Sweet Momentum service, communicate with you about your account, and send service-related notifications.

DATA STORAGE
Your data is stored securely on servers located in the United States. We use industry-standard encryption and security measures to protect your information.

DATA SHARING
We do not sell your personal information to third parties. We may share data with service providers who assist in operating our platform, subject to confidentiality obligations.

YOUR RIGHTS
You have the right to access, correct, or delete your personal information. You may request account deletion at any time by contacting us.

COOKIES
We use cookies and similar tracking technologies to operate and improve the service. You can control cookie settings through your browser.

CHILDREN'S PRIVACY
Sweet Momentum is not intended for users under 13 years of age. We do not knowingly collect information from children under 13.

CHANGES TO THIS POLICY
We may update this Privacy Policy periodically. We will notify you of significant changes via email or an in-app notice.

CONTACT
For privacy inquiries, contact us at track@sweetmo.io.`,
  },
  eula: {
    icon: FileText,
    defaultTitle: "End User License Agreement",
    defaultBody: `This End User License Agreement ("EULA") is a legal agreement between you and Sweet Momentum for the use of the Sweet Momentum application.

LICENSE GRANT
Subject to the terms of this EULA, Sweet Momentum grants you a limited, non-exclusive, non-transferable, revocable license to use the application for your personal, non-commercial purposes.

RESTRICTIONS
You may not: copy, modify, or distribute the application; reverse engineer or attempt to extract the source code; use the application for any unlawful purpose; or transfer your license to another person.

INTELLECTUAL PROPERTY
The application, including all content, features, and functionality, is owned by Sweet Momentum and is protected by copyright, trademark, and other intellectual property laws.

USER DATA
By using the application, you grant Sweet Momentum the right to use your data to provide and improve the service, as described in our Privacy Policy.

UPDATES
Sweet Momentum may provide updates, upgrades, or new versions of the application. These updates may be automatic and are subject to the terms of this EULA.

TERMINATION
This license is effective until terminated. Your rights under this license will terminate automatically if you fail to comply with any of its terms.

DISCLAIMER OF WARRANTIES
The application is provided "as is" and "as available" without warranty of any kind, express or implied.

LIMITATION OF LIABILITY
To the maximum extent permitted by law, Sweet Momentum shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the application.

GOVERNING LAW
This EULA shall be governed by and construed in accordance with applicable laws.

CONTACT
For questions about this EULA, contact us at track@sweetmo.io.`,
  },
};

const LEGAL_LINKS = [
  { key: "terms",   label: "Terms & Conditions" },
  { key: "privacy", label: "Privacy Policy" },
  { key: "eula",    label: "EULA" },
];

function LegalFooterLinks({ current }: { current: string }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      {LEGAL_LINKS.filter(l => l.key !== current).map(l => (
        <Link key={l.key} href={`/${l.key}`}>
          <a className="hover:text-foreground transition-colors">{l.label}</a>
        </Link>
      ))}
    </div>
  );
}

function LegalPage({ pageKey }: { pageKey: "terms" | "privacy" | "eula" }) {
  const def = LEGAL_DEFS[pageKey];
  const Icon = def.icon;

  const { data: config, isLoading } = useQuery<LegalPageConfig>({
    queryKey: ["/api/public/legal", pageKey],
    queryFn: () => apiRequest("GET", `/api/public/legal/${pageKey}`).then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const title   = config?.title?.trim()       || def.defaultTitle;
  const body    = config?.body?.trim()        || def.defaultBody;
  const heroImg = config?.heroImageUrl?.trim() || null;
  const updatedAt = config?.updatedAt
    ? new Date(config.updatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header banner */}
      <div className="relative border-b border-border overflow-hidden">
        {heroImg ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${heroImg})` }}
            />
            <div className="absolute inset-0 bg-background/85" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-background" />
        )}
        <div className="relative px-6 md:px-10 py-12 max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <span className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Sweet Momentum</span>
          </div>
          {isLoading ? (
            <>
              <Skeleton className="h-9 w-2/3 mb-2" />
              <Skeleton className="h-4 w-40" />
            </>
          ) : (
            <>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-tight mb-2">{title}</h1>
              {updatedAt && (
                <p className="text-xs text-muted-foreground">Last updated: {updatedAt}</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-6 md:px-10 py-10 max-w-3xl mx-auto">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className={`h-4 ${i % 3 === 2 ? "w-4/5" : "w-full"}`} />
            ))}
          </div>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none">
            {body.split("\n\n").map((block, i) => {
              // Detect section headings (ALL CAPS lines or short lines ending with nothing special)
              const isHeading = block.trim() === block.trim().toUpperCase() && block.trim().length < 80 && !block.trim().includes(".");
              return isHeading ? (
                <h2 key={i} className="text-sm font-black tracking-widest uppercase mt-8 mb-2 text-foreground">
                  {block.trim()}
                </h2>
              ) : (
                <p key={i} className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line mb-4">
                  {block.trim()}
                </p>
              );
            })}
          </div>
        )}

        {/* Footer nav between legal pages */}
        <div className="mt-12 pt-6 border-t border-border space-y-4">
          <p className="text-xs text-muted-foreground">Other legal documents:</p>
          <LegalFooterLinks current={pageKey} />
          <div className="pt-2">
            <Link href="/dashboard">
              <a className="text-xs text-primary hover:underline">← Back to Sweet Momentum</a>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TermsPage()   { return <LegalPage pageKey="terms" />; }
export function PrivacyPage() { return <LegalPage pageKey="privacy" />; }
export function EulaPage()    { return <LegalPage pageKey="eula" />; }
