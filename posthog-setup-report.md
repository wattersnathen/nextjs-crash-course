<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the DevEvent Next.js App Router project. The following changes were made:

- **`instrumentation-client.ts`** (new): Initializes PostHog client-side using the Next.js 15.3+ `instrumentation-client` pattern, with reverse proxy routing, error tracking (`capture_exceptions`), and debug mode in development.
- **`next.config.ts`**: Added reverse proxy rewrites to route PostHog ingestion requests through `/ingest`, reducing ad blocker interference.
- **`components/ExploreBtn.tsx`**: Added `posthog.capture('explore_events_clicked')` in the button's click handler to track top-of-funnel CTA engagement.
- **`components/EventCard.tsx`**: Converted to a client component (`'use client'`) and added `posthog.capture('event_card_clicked', { event_title, event_slug, event_location, event_date })` in the link's click handler to track event interest.
- **`.env.local`**: Set `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` (gitignore covered).

| Event | Description | File |
|---|---|---|
| `explore_events_clicked` | User clicked the 'Explore Events' CTA button on the homepage hero section | `components/ExploreBtn.tsx` |
| `event_card_clicked` | User clicked on an event card to view event details (includes title, slug, location, date) | `components/EventCard.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://us.posthog.com/project/344278/dashboard/1364607
- **Event Engagement Trends** (line chart: both events over 30 days): https://us.posthog.com/project/344278/insights/cczgYwzQ
- **Explore-to-Event-Click Conversion Funnel** (steps funnel): https://us.posthog.com/project/344278/insights/f4ntbIdn
- **Most Clicked Events** (bar chart by event title): https://us.posthog.com/project/344278/insights/gVFjRuks
- **Unique Users Clicking Events** (daily active users): https://us.posthog.com/project/344278/insights/mufWyBV0
- **Event Clicks by Location** (pie chart by event location): https://us.posthog.com/project/344278/insights/GJrABwEo

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
