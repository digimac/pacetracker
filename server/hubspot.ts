// HubSpot one-way sync — creates/updates contacts in HubSpot when users
// register, upgrade, downgrade, or are deleted in Sweet Momentum.
//
// Requires HUBSPOT_TOKEN env var (HubSpot Private App token with
// crm.objects.contacts.read + crm.objects.contacts.write scopes).

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
const BASE = "https://api.hubapi.com";

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${HUBSPOT_TOKEN}`,
  };
}

// ── Find an existing contact by email ────────────────────────────────────────
async function findContactByEmail(email: string): Promise<string | null> {
  const res = await fetch(`${BASE}/crm/v3/objects/contacts/search`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      filterGroups: [{
        filters: [{ propertyName: "email", operator: "EQ", value: email }],
      }],
      properties: ["email"],
      limit: 1,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0]?.id ?? null;
}

// ── Build the properties object sent to HubSpot ───────────────────────────────
function buildProperties(opts: {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string;
  plan?: string;
  category?: string | null;
  timezone?: string | null;
  joinedAt?: Date;
}) {
  const props: Record<string, string> = {
    email: opts.email,
  };
  if (opts.firstName)   props.firstname  = opts.firstName;
  if (opts.lastName)    props.lastname   = opts.lastName;
  if (!opts.firstName && !opts.lastName && opts.displayName) {
    // Split displayName into first/last as best-effort
    const parts = opts.displayName.trim().split(" ");
    props.firstname = parts[0];
    if (parts.length > 1) props.lastname = parts.slice(1).join(" ");
  }
  if (opts.plan)        props.sweet_momentum_plan     = opts.plan;
  if (opts.category)    props.sweet_momentum_community = opts.category;
  if (opts.timezone)    props.sweet_momentum_timezone  = opts.timezone;
  if (opts.joinedAt)    props.sweet_momentum_joined    = opts.joinedAt.toISOString().split("T")[0];
  return props;
}

// ── Upsert a contact (create or update by email) ─────────────────────────────
async function upsertContact(props: Record<string, string>): Promise<void> {
  const existingId = await findContactByEmail(props.email);

  if (existingId) {
    // Update existing contact
    const res = await fetch(`${BASE}/crm/v3/objects/contacts/${existingId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ properties: props }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[hubspot] PATCH contact ${existingId} failed:`, err);
    } else {
      console.log(`[hubspot] Updated contact ${existingId} (${props.email})`);
    }
  } else {
    // Create new contact
    const res = await fetch(`${BASE}/crm/v3/objects/contacts`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ properties: props }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[hubspot] POST contact failed for ${props.email}:`, err);
    } else {
      const data = await res.json();
      console.log(`[hubspot] Created contact ${data.id} (${props.email})`);
    }
  }
}

// ── Public sync functions called from routes ──────────────────────────────────

export async function hubspotSyncNewUser(user: {
  email: string;
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  category?: string | null;
  createdAt: Date;
}, timezone?: string | null): Promise<void> {
  if (!HUBSPOT_TOKEN) return;
  try {
    const props = buildProperties({
      email:       user.email,
      firstName:   user.firstName,
      lastName:    user.lastName,
      displayName: user.displayName,
      plan:        "free",
      category:    user.category,
      timezone,
      joinedAt:    user.createdAt,
    });
    await upsertContact(props);
  } catch (e: any) {
    console.error("[hubspot] syncNewUser error:", e?.message);
  }
}

export async function hubspotSyncPlanChange(user: {
  email: string;
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
}, plan: "free" | "pro"): Promise<void> {
  if (!HUBSPOT_TOKEN) return;
  try {
    const props = buildProperties({
      email:       user.email,
      firstName:   user.firstName,
      lastName:    user.lastName,
      displayName: user.displayName,
      plan,
    });
    await upsertContact(props);
  } catch (e: any) {
    console.error("[hubspot] syncPlanChange error:", e?.message);
  }
}

export async function hubspotSyncDeleteUser(email: string): Promise<void> {
  if (!HUBSPOT_TOKEN) return;
  try {
    // Mark as churned rather than deleting the HubSpot contact
    const existingId = await findContactByEmail(email);
    if (!existingId) return;
    const res = await fetch(`${BASE}/crm/v3/objects/contacts/${existingId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({
        properties: { sweet_momentum_plan: "deleted" },
      }),
    });
    if (!res.ok) {
      console.error(`[hubspot] Delete-mark failed for ${email}:`, await res.text());
    } else {
      console.log(`[hubspot] Marked contact ${existingId} as deleted (${email})`);
    }
  } catch (e: any) {
    console.error("[hubspot] syncDeleteUser error:", e?.message);
  }
}
