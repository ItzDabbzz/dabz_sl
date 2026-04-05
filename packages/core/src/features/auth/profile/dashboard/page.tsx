import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/core";
import AccountSwitcher from "@/features/auth/profile/components/account-switch";
import UserCard from "./user-card";
import { OrganizationCard } from "./organization-card";
import APICard from "./api-card";

export default async function Page() {
  const requestHeaders = await headers();
  const [session, activeSessions, deviceSessions, organization] = await Promise.all([
    auth.api.getSession({ headers: requestHeaders }),
    auth.api.listSessions({ headers: requestHeaders }),
    auth.api.listDeviceSessions({ headers: requestHeaders }),
    auth.api.getFullOrganization({ headers: requestHeaders }),
  ]).catch((e) => {
    console.log(e);
    throw redirect("/sign-in");
  });

  if (!session?.session) {
    redirect("/sign-in");
  }

  // Serialize each object once so RSC can deduplicate by reference across props
  const s = JSON.parse(JSON.stringify(session));
  const sActiveSessions = JSON.parse(JSON.stringify(activeSessions));
  const sDeviceSessions = JSON.parse(JSON.stringify(deviceSessions));
  const sOrganization = JSON.parse(JSON.stringify(organization));

  return (
    <div className="w-full">
      <div className="flex gap-4 flex-col">
        <AccountSwitcher sessions={sDeviceSessions} />
        <UserCard
          session={s}
          activeSessions={sActiveSessions}
        />
        <OrganizationCard
          session={s}
          activeOrganization={sOrganization}
        />
        <APICard session={s} />
      </div>
    </div>
  );
}
