import dynamic from 'next/dynamic';
export function generateStaticParams() {
    return [{ id: '_' }];
}

export const dynamicParams = false;
const ClienteDetailPage = dynamic(() => import('./ClienteDetailPage'));
export default function Page() { return <ClienteDetailPage />; }
