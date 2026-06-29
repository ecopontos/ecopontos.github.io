import dynamic from "next/dynamic";
export function generateStaticParams() {
    return [{ id: '_' }];
}

export const dynamicParams = false;

const TaskDetailPage = dynamic(() => import("./TaskDetailPage"));

export default function Page() {
    return <TaskDetailPage />;
}
