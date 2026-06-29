import dynamic from 'next/dynamic';

export function generateStaticParams() {
    return [{ id: '_' }];
}

export const dynamicParams = false;

const PageClient = dynamic(() => import('./EditModuleClient'));

export default function Page() {
    return <PageClient />;
}
