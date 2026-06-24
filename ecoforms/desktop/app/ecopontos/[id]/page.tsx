import dynamic from 'next/dynamic';
const EcopontoDetailPage = dynamic(() => import('./EcopontoDetailPage'));

export function generateStaticParams() {
    return [{ id: '_' }];
}

export const dynamicParams = false;

export default function Page() { return <EcopontoDetailPage />; }
