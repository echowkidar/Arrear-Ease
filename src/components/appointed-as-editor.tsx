"use client";

// Inline "Appointed / Promoted as" editor used in the Load Saved Arrear Statement list.
// Pick from the list or type; the Save button appears only when the text changed.

import * as React from "react";
import { Loader2, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { shortAppointedReason } from "@/lib/appointed";

export function AppointedAsEditor({
  value,
  listId,
  disabled,
  onSave,
}: {
  value: string;
  listId: string;
  disabled?: boolean;
  onSave: (next: string) => Promise<void>;
}) {
  const [draft, setDraft] = React.useState(value || "");
  const [saving, setSaving] = React.useState(false);

  // follow the saved value (after a save, or when the list is reloaded)
  React.useEffect(() => setDraft(value || ""), [value]);

  const dirty = draft.trim() !== (value || "").trim();

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await onSave(draft.trim());
    } finally {
      setSaving(false);
    }
  };

  const short = shortAppointedReason(draft);

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-col gap-0.5">
        <Input
          value={draft}
          list={listId}
          placeholder="Not set"
          disabled={disabled || saving}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            } else if (e.key === "Escape") {
              setDraft(value || "");
            }
          }}
          className="h-8 w-44 text-xs"
          aria-label="Appointed / Promoted as"
        />
        {short && <span className="text-[10px] text-muted-foreground">Summary reason: {short}</span>}
      </div>
      {dirty && (
        <Button size="sm" className="h-8 px-2" onClick={save} disabled={disabled || saving} title="Save this value to the statement">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          <span className="ml-1">Save</span>
        </Button>
      )}
    </div>
  );
}
