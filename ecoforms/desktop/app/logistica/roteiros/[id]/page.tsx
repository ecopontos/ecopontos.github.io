import dynamic from 'next/dynamic';
const RoteiroDetailPage = dynamic(() => import('./RoteiroDetailPage'));
export default function Page() { return <RoteiroDetailPage />; }
