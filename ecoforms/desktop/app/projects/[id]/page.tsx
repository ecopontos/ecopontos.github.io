import dynamic from 'next/dynamic';
export function generateStaticParams() {
    return [{ id: '_' }];
}

export const dynamicParams = false;

const ProjectDetailPage = dynamic(() => import('./ProjectDetailPage'));


export default function Page() {
    return <ProjectDetailPage />;
}
