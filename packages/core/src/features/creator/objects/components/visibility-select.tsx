"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function VisibilitySelect({
  name,
  defaultValue = "private",
}: {
  name: string;
  defaultValue?: "private" | "org" | "public" | string;
}) {
  const [value, setValue] = React.useState<string>(defaultValue);
  return (
    <div className="grid gap-1.5">
      <input type="hidden" name={name} value={value} />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger>
          <SelectValue placeholder="Select visibility" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="private">private</SelectItem>
          <SelectItem value="org">org</SelectItem>
          <SelectItem value="public">public</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
