'use client';
import dynamic from 'next/dynamic';

const ModuloPageClient = dynamic(() => import('./ModuloPageClient'), { ssr: false });

export default function ModuloLoader() {
    return <ModuloPageClient />;
}
