/**
 * Shapes and labels for the trash, free of the database so client components
 * can import them; trash.ts re-exports everything here.
 */

export type TrashEntity = "obra" | "certificado" | "pagina" | "imagen" | "edificio" | "unidad" | "jornada";

export const TRASH_ENTITY_LABELS: Record<TrashEntity, string> = {
  obra: "Obra",
  certificado: "Certificado",
  pagina: "Página",
  imagen: "Imagen",
  edificio: "Edificio",
  unidad: "Unidad",
  jornada: "Jornada",
};

export type TrashItem = {
  id: number;
  entity: TrashEntity;
  entity_id: string;
  label: string;
  detail: string;
  deleted_at: string;
  deleted_by_name: string;
  /** Files held in the trash with the record. */
  files: number;
};
