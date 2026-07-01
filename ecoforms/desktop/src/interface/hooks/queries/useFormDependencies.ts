/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { getContainerAsync } from "../utils/useContainer";

export interface FormDependency {
    form_id: string;
    titulo: string;
}

export function useFormDependencies(tipo: string | null) {
    const [dependencies, setDependencies] = useState<FormDependency[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!tipo) {
            setDependencies([]);
            return;
        }

        let cancelled = false;
        setLoading(true);

        getContainerAsync()
            .then((db) => db.dataRegistry.findFormsUsingRegistryType.execute(tipo))
            .then((result) => {
                if (!cancelled) {
                    setDependencies(result);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setDependencies([]);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [tipo]);

    return { dependencies, loading };
}
