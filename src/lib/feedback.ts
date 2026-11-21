/** Where feedback goes for people without a GitHub account. */
export const FEEDBACK_EMAIL = 'bikefitter@spencerboucher.com';
export const ISSUES_URL = 'https://github.com/justmytwospence/bikefit/issues';

export const feedbackMailto = (subject = 'Bikefitter feedback'): string =>
  `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}`;
