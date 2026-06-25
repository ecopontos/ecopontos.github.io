/**
 * Página de formulário - Server Component wrapper
 */

import { Metadata } from 'next';
import FormPage from './page.client';

export const metadata: Metadata = {
  title: 'Editor de Formulário',
  description: 'Criar e editar formulários',
};

export default function Page() {
  return <FormPage />;
}