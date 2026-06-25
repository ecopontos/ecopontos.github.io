import ModuloLoader from './ModuloLoader';

export function generateStaticParams() {
    // Placeholder so Next.js static export is satisfied.
    // Actual routing is handled client-side by Tauri.
    return [{ slug: '_' }];
}

export const dynamicParams = false;

export default function Page() {
    return <ModuloLoader />;
}
