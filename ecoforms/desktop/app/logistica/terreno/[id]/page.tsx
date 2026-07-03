import dynamic from 'next/dynamic';

export function generateStaticParams() {
    return [{ id: '_' }];
}

export const dynamicParams = false;

const TerrenoDetailPage = dynamic(() => import('./TerrenoDetailPage'));

export default function Page() {
    return <TerrenoDetailPage />;
}
