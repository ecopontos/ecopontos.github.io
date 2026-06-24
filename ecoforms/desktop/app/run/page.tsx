/**
 * Página de execução de formulário - Server Component wrapper
 */

import { Metadata } from 'next';
import RunFormPage from './page.client';

export const metadata: Metadata = {
  title: 'Executar Formulário',
  description: 'Preencher formulário',
};

export default function Page() {
  return <RunFormPage />;
}