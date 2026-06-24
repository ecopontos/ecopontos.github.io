import TarefaRedirectClient from './TarefaRedirectClient';

export function generateStaticParams() {
    return [{ id: '_' }];
}

export const dynamicParams = false;

export default function Page() {
    return <TarefaRedirectClient />;
}
