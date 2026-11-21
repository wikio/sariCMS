import { cmsFetch } from './cms';

/** Politique effective du formulaire. Sans réponse explicite, exiger le CAPTCHA. */
export async function adminCaptchaRequired(): Promise<boolean> {
  try {
    const policy = await cmsFetch<{ captchaRequired: boolean }>('/public/admin-login-policy');
    return policy?.captchaRequired !== false;
  } catch {
    return true;
  }
}
