import dynamic from 'next/dynamic';
export function generateStaticParams() {
    return [{ id: '_' }];
}

export const dynamicParams = false;
const RoteiroDetailPage = dynamic(() => import('./RoteiroDetailPage'));
export default function Page() { return <RoteiroDetailPage />; }
