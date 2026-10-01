"use client";

import { FIELDS, GROUP_LABELS, type FieldGroup } from "@/lib/inventory/fields";

export type Values = Record<string, string>;

/**
 * The grouped field layout shared by the edit and create forms, generated from
 * FIELDS so a new column shows up in both without touching either.
 */
export default function ArtworkFieldGrid({
  values,
  initial,
  onChange,
  readOnlyKeys,
  showDirty = true,
}: {
  values: Values;
  initial: Values;
  onChange: (key: string, value: string) => void;
  readOnlyKeys: ReadonlySet<string>;
  /** Off while creating, where every filled field would otherwise look edited. */
  showDirty?: boolean;
}) {
  const groups = Object.keys(GROUP_LABELS) as FieldGroup[];

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group}>
          <h2 className="border-b border-[var(--stroke-soft)] pb-1.5 text-xs uppercase tracking-wide text-[var(--ink-3)]">
            {GROUP_LABELS[group]}
          </h2>
          <div className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {FIELDS.filter((f) => f.group === group).map((field) => {
              const isLong = field.type === "longtext";
              const isDirty = showDirty && (values[field.key] ?? "") !== (initial[field.key] ?? "");
              const readOnly = readOnlyKeys.has(field.key);

              return (
                <label
                  key={field.key}
                  className={`flex flex-col gap-1 ${isLong ? "sm:col-span-2" : ""}`}
                >
                  <span className="flex items-center gap-1.5 text-xs text-[var(--ink-3)]">
                    {field.label}
                    {isDirty && <span className="size-1.5 rounded-full bg-amber-500" />}
                  </span>
                  {isLong ? (
                    <textarea
                      value={values[field.key] ?? ""}
                      onChange={(e) => onChange(field.key, e.target.value)}
                      rows={4}
                      className="w-full rounded border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm leading-relaxed outline-none transition focus:border-[var(--brand)]"
                    />
                  ) : (
                    <input
                      type={field.type === "int" || field.type === "money" ? "number" : "text"}
                      value={values[field.key] ?? ""}
                      onChange={(e) => onChange(field.key, e.target.value)}
                      readOnly={readOnly}
                      className={`w-full rounded border px-3 py-1.5 text-sm outline-none transition focus:border-[var(--brand)] ${
                        readOnly
                          ? "border-[var(--stroke-soft)] bg-[var(--hover)] text-[var(--ink-3)]"
                          : "border-[var(--stroke)] bg-[var(--surface)]"
                      }`}
                    />
                  )}
                </label>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
