"use client";
import {
  createContext,
  useContext,
  useEffect,
  type Dispatch,
  type SetStateAction,
} from "react";

export type ProjectBreadcrumb = { href: string; title: string };
export const ProjectBreadcrumbContext = createContext<
  Dispatch<SetStateAction<ProjectBreadcrumb | null>>
>(() => {});

export function useProjectBreadcrumb(href: string, title: string | undefined) {
  const setBreadcrumb = useContext(ProjectBreadcrumbContext);
  useEffect(() => {
    if (!title) return;
    setBreadcrumb({ href, title });
    return () => {
      setBreadcrumb((current) => (current?.href === href ? null : current));
    };
  }, [href, title, setBreadcrumb]);
}
