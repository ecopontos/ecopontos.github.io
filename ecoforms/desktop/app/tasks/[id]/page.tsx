import dynamic from "next/dynamic";

const TaskDetailPage = dynamic(() => import("./TaskDetailPage"));

export default function Page() {
    return <TaskDetailPage />;
}
