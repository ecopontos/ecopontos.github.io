import dynamic from 'next/dynamic';

export function generateStaticParams() {
    return [{ id: '_' }];
}

export const dynamicParams = false;

const EditarServiceSlotClient = dynamic(() => import('./EditarServiceSlotClient'));

export default function Page() {
    return <EditarServiceSlotClient />;
}
