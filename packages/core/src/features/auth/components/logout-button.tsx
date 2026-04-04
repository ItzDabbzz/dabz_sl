"use client";

import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link";
  className?: string;
  label?: string;
}

export function LogoutButton({ size = "sm", variant = "outline", className, label = "Logout" }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      disabled={loading}
      onClick={async () => {
        try {
          setLoading(true);
          await signOut({});
        } catch {
          // no-op
        } finally {
          setLoading(false);
          router.refresh();
        }
      }}
    >
      {label}
    </Button>
  );
}

export default LogoutButton;
