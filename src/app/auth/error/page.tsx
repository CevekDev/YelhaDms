import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

/**
 * Locale-redirect page: NextAuth points here on error, we detect the browser locale
 * and redirect to the appropriate locale-prefixed error page.
 */
export default function ErrorRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const acceptLanguage = headers().get('accept-language') ?? 'fr';
  const locale = acceptLanguage.split(',')[0]?.split('-')[0] ?? 'fr';
  const supported = ['fr', 'en', 'ar'];
  const resolvedLocale = supported.includes(locale) ? locale : 'fr';

  const query = new URLSearchParams();
  if (searchParams.error) query.set('error', searchParams.error);

  const qs = query.toString();
  redirect(`/${resolvedLocale}/auth/error${qs ? `?${qs}` : ''}`);
}
