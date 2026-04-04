"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onCreate: (form: FormData) => Promise<void>;
}

export function CreateWebhookDialog({ onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<string>("");
  const [presets, setPresets] = useState<{ name: string; events: string[] }[]>([]);
  const selected = useMemo(() => new Set(events.split(/\s*,\s*/).filter(Boolean)), [events]);
  const allEvents = useMemo(() => Array.from(new Set(presets.flatMap((g) => g.events))).sort(), [presets]);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/public/webhooks/events")
      .then((r) => r.json())
      .then((d) => setPresets(d?.groups || []))
      .catch(() => setPresets([]));
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create Webhook</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create webhook endpoint</DialogTitle>
          <DialogDescription>
            Provide a public HTTPS URL, optional signing secret, and one or more events.
          </DialogDescription>
        </DialogHeader>
        <form
          action={async (fd) => {
            try {
              await onCreate(fd);
              toast.success("Webhook created");
              setOpen(false);
              setEvents("");
            } catch {
              toast.error("Failed to create webhook");
            }
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="url">Target URL</Label>
            <Input id="url" name="url" type="url" placeholder="https://example.com/webhooks" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="events">Events</Label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Input
                  id="events"
                  name="events"
                  placeholder="config.updated, snapshot.restored"
                  value={events}
                  onChange={(e) => setEvents(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCmdOpen(true)}
                  className="inline-flex items-center gap-1"
                >
                  <ChevronsUpDown className="size-4" />
                  Browse
                </Button>
              </div>
              {selected.size > 0 && (
                <div className="flex flex-wrap gap-1">
                  {Array.from(selected).map((e) => (
                    <button
                      type="button"
                      key={e}
                      onClick={() => {
                        const list = new Set(selected);
                        list.delete(e);
                        setEvents(Array.from(list).join(", "));
                      }}
                    >
                      <Badge variant="default">{e}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Use the input or Browse to search and multi-select. Leave blank to subscribe to all supported events.</p>
            {presets.length > 0 && (
              <div className="mt-2 space-y-2">
                {presets.map((g) => (
                  <div key={g.name} className="flex items-start gap-2">
                    <div className="w-28 shrink-0 text-xs text-muted-foreground">{g.name}</div>
                    <div className="flex flex-wrap gap-1">
                      {g.events.map((e) => {
                        const active = selected.has(e);
                        return (
                          <button
                            key={e}
                            type="button"
                            onClick={() => {
                              const list = new Set(selected);
                              if (active) list.delete(e); else list.add(e);
                              setEvents(Array.from(list).join(", "));
                            }}
                          >
                            <Badge variant={active ? "default" : "secondary"}>{e}</Badge>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="secret">Signing secret</Label>
            <Input id="secret" name="secret" placeholder="Optional secret" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </form>
        <div className="mt-2 text-xs text-muted-foreground">
          Verify requests: include HMAC verification with your secret. Learn more in docs.
        </div>

        {/* Command palette multiselect */}
        <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen} title="Select webhook events" description="Search and toggle events to subscribe to">
          <CommandInput placeholder="Search events..." />
          <CommandList>
            <CommandEmpty>No events found.</CommandEmpty>
            {presets.map((g) => (
              <CommandGroup key={g.name} heading={g.name}>
                {g.events.map((ev) => {
                  const active = selected.has(ev);
                  return (
                    <CommandItem
                      key={ev}
                      onSelect={() => {
                        const list = new Set(selected);
                        if (active) list.delete(ev); else list.add(ev);
                        setEvents(Array.from(list).join(", "));
                      }}
                    >
                      <Check className={cn("mr-2 size-4", active ? "opacity-100" : "opacity-0")} />
                      <span>{ev}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
            {allEvents.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="All events">
                  {allEvents.map((ev) => {
                    const active = selected.has(ev);
                    return (
                      <CommandItem
                        key={ev}
                        onSelect={() => {
                          const list = new Set(selected);
                          if (active) list.delete(ev); else list.add(ev);
                          setEvents(Array.from(list).join(", "));
                        }}
                      >
                        <Check className={cn("mr-2 size-4", active ? "opacity-100" : "opacity-0")} />
                        <span>{ev}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </CommandDialog>
      </DialogContent>
    </Dialog>
  );
}
