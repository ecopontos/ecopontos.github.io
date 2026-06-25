import dynamic from 'next/dynamic';

const ProjectDetailPage = dynamic(() => import('./ProjectDetailPage'));


export default function Page() {
    return <ProjectDetailPage />;
}
