import dynamic from 'next/dynamic';

export function generateStaticParams() {
    return [{ id: '_' }];
}

export const dynamicParams = false;

const PageClient = dynamic(() => import('./page.client'));

export default function Page() {
    return <PageClient />;
}
