import { Suspense } from 'react';
import ViewSubmissionClient from '../page.client';
export function generateStaticParams() {
    return [{ id: '_' }];
}

export const dynamicParams = false;

interface ViewSubmissionByIdPageProps {
    params: Promise<{ id: string }>;
}

export default async function ViewSubmissionByIdPage({ params }: ViewSubmissionByIdPageProps) {
    const { id } = await params;

    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        }>
            <ViewSubmissionClient paramsId={id} />
        </Suspense>
    );
}