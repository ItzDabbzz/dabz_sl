"use client";

import { useState } from "react";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CopyButton from "@/components/ui/copy-button";

export function VerificationDocsDrawer() {
  const [open, setOpen] = useState(false);

  const node = `import crypto from 'node:crypto';

export function verify({ body, signature, secret }: { body: string; signature: string; secret: string }) {
  const h = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(signature));
}`;

  const python = `import hmac, hashlib

def verify(body: bytes, signature: str, secret: str) -> bool:
    mac = hmac.new(secret.encode('utf-8'), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(mac, signature)`;

  const go = `package verify

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
)

func Verify(body []byte, signature string, secret string) bool {
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write(body)
    expected := hex.EncodeToString(mac.Sum(nil))
    return hmac.Equal([]byte(expected), []byte(signature))
}`;

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline">Verification docs</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Verify webhook signatures</DrawerTitle>
          <DrawerDescription>Requests include the X-Webhook-Signature header with an HMAC-SHA256 over the raw body.</DrawerDescription>
        </DrawerHeader>
        <div className="p-4">
          <Tabs defaultValue="node">
            <TabsList>
              <TabsTrigger value="node">Node</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
              <TabsTrigger value="go">Go</TabsTrigger>
            </TabsList>
            <TabsContent value="node">
              <div className="relative">
                <pre className="rounded-md border bg-muted p-3 text-xs overflow-auto whitespace-pre-wrap">{node}</pre>
                <div className="absolute right-2 top-2"><CopyButton textToCopy={node} /></div>
              </div>
            </TabsContent>
            <TabsContent value="python">
              <div className="relative">
                <pre className="rounded-md border bg-muted p-3 text-xs overflow-auto whitespace-pre-wrap">{python}</pre>
                <div className="absolute right-2 top-2"><CopyButton textToCopy={python} /></div>
              </div>
            </TabsContent>
            <TabsContent value="go">
              <div className="relative">
                <pre className="rounded-md border bg-muted p-3 text-xs overflow-auto whitespace-pre-wrap">{go}</pre>
                <div className="absolute right-2 top-2"><CopyButton textToCopy={go} /></div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        <DrawerFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
