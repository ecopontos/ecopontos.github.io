"use client";

import { ProtectedPage } from "@/components/auth/PermissionGuards";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ProtectedPage permission="users.view_all" redirectTo="/">
            <div className="min-h-full p-6">
                {children}
            </div>
        </ProtectedPage>
    );
}
