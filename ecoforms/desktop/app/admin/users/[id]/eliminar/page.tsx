import dynamic from 'next/dynamic';

export function generateStaticParams() {
    return [{ id: '_' }];
}

export const dynamicParams = false;

const PageClient = dynamic(() => import('./EliminarTitularClient'));

export default function Page() {
    return <PageClient />;
}
