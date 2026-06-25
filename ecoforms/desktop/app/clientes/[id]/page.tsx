import dynamic from 'next/dynamic';
const ClienteDetailPage = dynamic(() => import('./ClienteDetailPage'));
export default function Page() { return <ClienteDetailPage />; }
