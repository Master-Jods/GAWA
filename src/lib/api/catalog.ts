import { supabase } from "@/lib/supabase/client";

export interface ProjectCategory {
  id: string;
  name: string;
  slug: string;
}

export interface CatalogSkill {
  id: string;
  name: string;
  slug: string;
  category_id?: string | null;
}

export async function fetchCategories(): Promise<ProjectCategory[]> {
  try {
    const { data, error } = await supabase
      .from("catalog_project_categories")
      .select("id, name, slug")
      .order("name", { ascending: true });

    if (error || !data || data.length === 0) {
      return [
        { id: "1", name: "Design & Creative", slug: "design" },
        { id: "2", name: "Web Development", slug: "development" },
        { id: "3", name: "Digital Marketing", slug: "marketing" },
        { id: "4", name: "Data & Analytics", slug: "data" },
        { id: "5", name: "Writing", slug: "writing" },
      ];
    }
    return data;
  } catch (err) {
    console.error("Error fetching categories:", err);
    return [];
  }
}

export async function fetchSkills(): Promise<CatalogSkill[]> {
  try {
    const { data, error } = await supabase
      .from("catalog_skills")
      .select("id, name, slug, category_id")
      .order("name", { ascending: true });

    if (error || !data) {
      return [];
    }
    return data;
  } catch (err) {
    console.error("Error fetching catalog skills:", err);
    return [];
  }
}
