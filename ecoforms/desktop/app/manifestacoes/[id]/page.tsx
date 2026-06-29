import dynamic from 'next/dynamic';
export function generateStaticParams() {
    return [{ id: '_' }];
}

export const dynamicParams = false;
const ManifestacaoDetailPage = dynamic(() => import('./ManifestacaoDetailPage'));
export default function Page() { return <ManifestacaoDetailPage />; }
