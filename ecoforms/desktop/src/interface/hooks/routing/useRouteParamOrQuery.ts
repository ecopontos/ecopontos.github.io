"use client";

import { useParams, useSearchParams } from "next/navigation";

export function useRouteParamOrQuery(name: string): string | null {
    const params = useParams<Record<string, string | string[]>>();
    const searchParams = useSearchParams();

    const routeValue = params?.[name];
    if (typeof routeValue === "string" && routeValue.length > 0) {
        return routeValue;
    }

    const queryValue = searchParams.get(name);
    return queryValue && queryValue.length > 0 ? queryValue : null;
}
