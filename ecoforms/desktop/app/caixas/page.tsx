"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CaixasRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/remocao");
    }, [router]);

    return null;
}
