import dynamic from 'next/dynamic';
const ManifestacaoDetailPage = dynamic(() => import('./ManifestacaoDetailPage'));
export default function Page() { return <ManifestacaoDetailPage />; }
