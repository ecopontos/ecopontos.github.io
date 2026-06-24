import { Suspense } from 'react';
import ViewSubmissionClient from './page.client';

export default function ViewSubmissionPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        }>
            <ViewSubmissionClient />
        </Suspense>
    );
}
