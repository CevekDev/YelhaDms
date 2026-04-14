import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

/**
 * Locale-redirect page: NextAuth points here, we detect the browser locale
 * and redirect to the appropriate locale-prefixed sign-in page.
 */
export default function SignInRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const acceptLanguage = headers().get('accept-language') ?? 'fr';
  const locale = acceptLanguage.split(',')[0]?.split('-')[0] ?? 'fr';
  const supported = ['fr', 'en', 'ar'];
  const resolvedLocale = supported.includes(locale) ? locale : 'fr';

  const query = new URLSearchParams();
  if (searchParams.callbackUrl) query.set('callbackUrl', searchParams.callbackUrl);
  if (searchParams.error) query.set('error', searchParams.error);

  const qs = query.toString();
  redirect(`/${resolvedLocale}/auth/signin${qs ? `?${qs}` : ''}`);
}
