// components/builder/BuiltPage.tsx
'use client';

/**
 * Rendu d'une page construite dans l'administration.
 *
 * La page arrive du champ `content` de la fiche, déjà coupé en deux par
 * `decodeBuilderDoc` : le HTML posé par le constructeur et le CSS qui
 * l'accompagne. Ce composant ne fait que trois choses, et c'est tout ce qui peut
 * être promis à un contenu saisi par un éditeur :
 *
 * 1. il assainit le HTML (`sanitizeBuilderHtml`, le même filet que les blocs de
 *    la page d'accueil : pas de `<script>`, pas d'`on*`, pas de `<form>`) ;
 * 2. il pose le CSS de la page dans une `<style>` locale — le kit du constructeur
 *    (`app/builder-kit.css`), lui, est déjà servi au site entier, ce qui évite
 *    qu'une page recopie cinq cents lignes de CSS dans la base ;
 * 3. il câble les blocs interactifs (diaporama, carrousel, visionneuse).
 *
 * Le conteneur porte la classe `sari-page` : c'est elle qui porte l'échelle
 * (couleurs, espacement, typographie) de tout le kit, et c'est pour la même
 * raison que le constructeur la pose aussi dans son canevas.
 */
import { useRef } from 'react';
import type { ConstructorPage } from '@/types';
import { sanitizeBuilderHtml } from '@/lib/home/config';
import { usePageBehaviors } from '@/components/builder/use-page-behaviors';

export default function BuiltPage({ page }: { page: ConstructorPage }) {
  const root = useRef<HTMLDivElement>(null);
  usePageBehaviors(root);
  const css = String(page.css || '').replace(/<\/style>/gi, '');
  const html = sanitizeBuilderHtml(page.html || '');
  return (
    <div ref={root} className="sari-page sari-shell">
      {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
