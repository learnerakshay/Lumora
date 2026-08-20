// Keep Lumora's public support identity separate from the inbox that receives
// messages. VITE_SUPPORT_EMAIL can change the destination at deploy time
// without changing any public-facing copy or scattering an inbox through UI.
export const SUPPORT_EMAIL_LABEL = 'support@getlumora.in';

const DEFAULT_SUPPORT_EMAIL_DESTINATION = 'akshaykrishna284@gmail.com';
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function resolveSupportEmailDestination(configuredEmail?: string): string {
  const candidate = configuredEmail?.trim();
  return candidate && EMAIL_ADDRESS_PATTERN.test(candidate)
    ? candidate
    : DEFAULT_SUPPORT_EMAIL_DESTINATION;
}

const supportEmailDestination = resolveSupportEmailDestination(import.meta.env?.VITE_SUPPORT_EMAIL);

export function buildSupportMailto(
  subject = 'Lumora Support Request',
  body = 'Hi Lumora Support,\n\nIssue / question:\n\nWorkspace / feature involved:\n\nAdditional details:\n',
): string {
  return `mailto:${supportEmailDestination}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const SUPPORT_MAILTO = buildSupportMailto();
