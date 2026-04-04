"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
	organization,
	useListOrganizations,
	useSession,
} from "@/lib/auth-client";
import { ActiveOrganization, Session } from "@/lib/auth-types";
import { ChevronDownIcon, PlusIcon } from "@radix-ui/react-icons";
import { Loader2, MailPlus, Users, Pencil, Trash2, Check, X } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import CopyButton from "@/components/ui/copy-button";
import Image from "next/image";

export function OrganizationCard(props: {
	session: Session | null;
	activeOrganization: ActiveOrganization | null;
}) {
	const organizations = useListOrganizations();
	const normalizeOrg = (org: ActiveOrganization | null): ActiveOrganization | null =>
		org
			? {
				  ...org,
				  members: org.members ?? [],
				  invitations: org.invitations ?? [],
				  teams: org.teams ?? [],
			  }
			: null;
	const [optimisticOrg, setOptimisticOrg] = useState<ActiveOrganization | null>(
		normalizeOrg(props.activeOrganization),
	);
	const [isRevoking, setIsRevoking] = useState<string[]>([]);
	const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
	const inviteVariants = {
		hidden: { opacity: 0, height: 0 },
		visible: { opacity: 1, height: "auto" },
		exit: { opacity: 0, height: 0 },
	};

	const { data } = useSession();
	const session = data || props.session;

	const currentMember = (optimisticOrg?.members ?? []).find(
		(member) => member.userId === session?.user.id,
	);

	return (
		<Card>
			<CardHeader className="space-y-4">
				<CardTitle>Organization</CardTitle>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<div className="flex items-center gap-1 cursor-pointer">
								<p className="text-sm sm:text-base">
									<span className="font-bold"></span>{" "}
									{optimisticOrg?.name || "Personal"}
								</p>

								<ChevronDownIcon />
							</div>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							<DropdownMenuItem
								className=" py-1"
								onClick={async () => {
									organization.setActive({
										organizationId: null,
									});
									setOptimisticOrg(null);
									setActiveTeamId(null);
								}}
							>
								<p className="text-sm sm">Personal</p>
							</DropdownMenuItem>
							{organizations.data?.map((org) => (
								<DropdownMenuItem
									className=" py-1"
									key={org.id}
									onClick={async () => {
										if (org.id === optimisticOrg?.id) {
											return;
										}
										// Optimistically show switching state with safe defaults
										setOptimisticOrg({
											// spread basic org fields from list item
											...org,
											// ensure arrays exist while we fetch full org
											members: [],
											invitations: [],
											teams: [],
										} as unknown as ActiveOrganization);
										const { data } = await organization.setActive({
											organizationId: org.id,
										});
										// Normalize server response to ensure arrays are always defined
										setOptimisticOrg(
											data
												? {
													  ...data,
													  members: data.members ?? [],
													  invitations: data.invitations ?? [],
													  teams: data.teams ?? [],
												  }
												: null,
										);
										setActiveTeamId(null);
									}}
								>
									<p className="text-sm sm">{org.name}</p>
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
					<div className="flex gap-2">
						{optimisticOrg?.id && (
							<CreateTeamDialog
								canManage={currentMember?.role === "owner" || currentMember?.role === "admin"}
								onCreated={async () => {
									const { data } = await organization.getFullOrganization({});
									if (data) setOptimisticOrg(normalizeOrg(data));
								}}
							/>
						)}
						<CreateOrganizationDialog />
					</div>
				</div>
				<div className="flex items-center gap-3 sm:gap-4">
					<Avatar className="rounded-none w-12 h-12 sm:w-14 sm:h-14 ring-1 ring-border">
						<AvatarImage
							className="object-cover w-full h-full rounded-none"
							src={optimisticOrg?.logo || undefined}
						/>
						<AvatarFallback className="rounded-none">
							{optimisticOrg?.name?.charAt(0) || "P"}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0">
						<p className="text-base sm:text-lg font-semibold truncate">{optimisticOrg?.name || "Personal"}</p>
						<p className="text-xs sm:text-sm text-muted-foreground">
							{(optimisticOrg?.members?.length ?? 1)} member{(optimisticOrg?.members?.length ?? 1) === 1 ? "" : "s"}
						</p>
						{optimisticOrg?.id && (
							<p className="text-xs text-muted-foreground truncate">
								Active team:{" "}
								{optimisticOrg?.teams?.find((t) => t.id === activeTeamId)?.name || "None"}
							</p>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
					<div className="flex flex-col gap-3">
						<p className="text-sm font-semibold text-foreground/90 border-b border-border pb-2">
							Members{optimisticOrg?.members ? ` (${optimisticOrg.members.length})` : ""}
						</p>
						<div className="flex flex-col gap-2">
							{(optimisticOrg?.members ?? []).map((member) => (
								<div
									key={member.id}
									className="flex justify-between items-center rounded-md border p-2 sm:p-3"
								>
									<div className="flex items-center gap-3">
										<Avatar className="w-10 h-10">
											<AvatarImage
												src={member.user.image || undefined}
												className="object-cover"
											/>
											<AvatarFallback>
												{member.user.name?.charAt(0)}
											</AvatarFallback>
										</Avatar>
										<div className="min-w-0">
											<p className="text-sm font-medium truncate">{member.user.name}</p>
											<div className="mt-0.5">
												<Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
													{member.role}
												</Badge>
											</div>
										</div>
									</div>
									{member.role !== "owner" &&
										(currentMember?.role === "owner" ||
											currentMember?.role === "admin") && (
										<Button
											size="sm"
											variant="destructive"
											onClick={() => {
												organization.removeMember({
													memberIdOrEmail: member.id,
												});
											}}
										>
											{currentMember?.id === member.id ? "Leave" : "Remove"}
										</Button>
									)}
								</div>
							))}
							{!optimisticOrg?.id && (
								<div className="flex items-center gap-3 rounded-md border p-2 sm:p-3">
									<Avatar className="w-10 h-10">
										<AvatarImage src={session?.user.image || undefined} />
										<AvatarFallback>
											{session?.user.name?.charAt(0)}
										</AvatarFallback>
									</Avatar>
									<div>
										<p className="text-sm font-medium">{session?.user.name}</p>
										<div className="mt-0.5"><Badge variant="secondary" className="text-[10px] uppercase">Owner</Badge></div>
									</div>
								</div>
							)}
						</div>
					</div>
					<div className="flex flex-col gap-8">
						{/* Teams */}
						<div className="flex flex-col gap-3">
							<p className="text-sm font-semibold text-foreground/90 border-b border-border pb-2 flex items-center justify-between">
								<span className="inline-flex items-center gap-2"><Users size={16} /> Teams{optimisticOrg?.teams ? ` (${optimisticOrg.teams.length})` : ""}</span>
							</p>
							<div className="flex flex-col gap-2">
								{(optimisticOrg?.teams || []).map((team) => (
									<div key={team.id} className="flex items-center justify-between rounded-md border p-2 sm:p-3">
										<div className="flex items-center gap-2 min-w-0">
											<p className="text-sm font-medium truncate">{team.name}</p>
											{activeTeamId === team.id && (
												<Badge className="text-[10px]" variant="secondary">Active</Badge>
											)}
										</div>
										<div className="flex items-center gap-1 sm:gap-2">
											<Button
												size="sm"
												variant="secondary"
												onClick={async () => {
													await organization.setActiveTeam({ teamId: team.id });
													setActiveTeamId(team.id);
													toast.success("Active team updated");
												}}
											>
												Set Active
											</Button>
											<TeamMembersDialog teamId={team.id} teamName={team.name} />
											{(currentMember?.role === "owner" || currentMember?.role === "admin") && (
												<>
													<RenameTeamInline
														teamId={team.id}
														name={team.name}
														onRenamed={(newName: string) => {
															setOptimisticOrg((prev) =>
																prev
																	? {
																		...prev,
																		teams: (prev.teams || []).map((t) =>
																			t.id === team.id ? { ...t, name: newName } : t,
																		),
																	}
																	: prev,
															);
													}}
													/>
													<Button
														variant="destructive"
														size="sm"
														onClick={async () => {
														const p = organization.removeTeam({ teamId: team.id });
														toast.promise(p, {
															loading: "Removing team...",
															success: "Team removed",
															error: (e) => e.error?.message || "Failed to remove team",
														});
														await p;
														setOptimisticOrg((prev) =>
															prev
																? {
																	...prev,
																	teams: (prev.teams || []).filter((t) => t.id !== team.id),
																}
															: prev,
														);
														if (activeTeamId === team.id) setActiveTeamId(null);
													}}
												>
													<Trash2 size={16} />
												</Button>
											</>
											)}
										</div>
									</div>
								))}
								{optimisticOrg?.teams?.length === 0 && (
									<motion.p
										className="text-sm text-muted-foreground"
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0 }}
									>
										No Teams
									</motion.p>
								)}
								{!optimisticOrg?.id && (
									<Label className="text-xs text-muted-foreground">
										You can&apos;t manage teams in your personal workspace.
									</Label>
								)}
							</div>
						</div>
						{/* Invites */}
						<div className="flex flex-col gap-3">
							<p className="text-sm font-semibold text-foreground/90 border-b border-border pb-2">
								Invites{optimisticOrg?.invitations ? ` (${(optimisticOrg.invitations.filter((i)=>i.status==="pending").length)})` : ""}
							</p>
							<div className="flex flex-col gap-2">
								<AnimatePresence>
									{(optimisticOrg?.invitations ?? [])
											.filter((invitation) => invitation.status === "pending")
											.map((invitation) => (
												<motion.div
													key={invitation.id}
													className="flex items-center justify-between rounded-md border p-2 sm:p-3"
													variants={inviteVariants}
													initial="hidden"
													animate="visible"
													exit="exit"
													layout
												>
													<div className="min-w-0">
														<p className="text-sm font-medium truncate">{invitation.email}</p>
														<div className="mt-0.5">
															<Badge variant="secondary" className="text-[10px] uppercase">{invitation.role}</Badge>
														</div>
													</div>
													<div className="flex items-center gap-2">
														<Button
															disabled={isRevoking.includes(invitation.id)}
															size="sm"
															variant="destructive"
															onClick={() => {
																organization.cancelInvitation(
																	{
																		invitationId: invitation.id,
																	},
																	{
																		onRequest: () => {
																			setIsRevoking((prev) => [...prev, invitation.id]);
																		},
																		onSuccess: () => {
																			toast.message("Invitation revoked successfully");
																			setIsRevoking((prev) => prev.filter((id) => id !== invitation.id));
																			setOptimisticOrg((prev) =>
																				prev
																					? {
																						...prev,
																						invitations: prev.invitations.filter(
																							(inv) => inv.id !== invitation.id,
																						),
																					}
																				: prev,
																			);
																	},
																	onError: (ctx) => {
																		toast.error(ctx.error.message);
																		setIsRevoking((prev) => prev.filter((id) => id !== invitation.id));
																	},
																	},
																);
														}}
													>
														{isRevoking.includes(invitation.id) ? (
															<Loader2 className="animate-spin" size={16} />
														) : (
															"Revoke"
														)}
													</Button>
													<div>
														<CopyButton
															textToCopy={`${typeof window !== 'undefined' ? window.location.origin : ''}/accept-invitation/${invitation.id}`}
														/>
													</div>
												</div>
											</motion.div>
										))}
								</AnimatePresence>
								{optimisticOrg?.invitations?.length === 0 && (
									<motion.p
										className="text-sm text-muted-foreground"
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0 }}
									>
										No Active Invitations
									</motion.p>
								)}
								{!optimisticOrg?.id && (
									<Label className="text-xs text-muted-foreground">
										You can&apos;t invite members to your personal workspace.
									</Label>
								)}
							</div>
						</div>
					</div>
					<div className="flex justify-end w-full mt-4">
						<div>
							<div>
								{optimisticOrg?.id && (
									<InviteMemberDialog
										setOptimisticOrg={setOptimisticOrg}
										optimisticOrg={optimisticOrg}
									/>
								)}
							</div>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function CreateOrganizationDialog() {
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [loading, setLoading] = useState(false);
	const [open, setOpen] = useState(false);
	const [isSlugEdited, setIsSlugEdited] = useState(false);
	const [logo, setLogo] = useState<string | null>(null);

	useEffect(() => {
		if (!isSlugEdited) {
			const generatedSlug = name.trim().toLowerCase().replace(/\s+/g, "-");
			setSlug(generatedSlug);
		}
	}, [name, isSlugEdited]);

	useEffect(() => {
		if (open) {
			setName("");
			setSlug("");
			setIsSlugEdited(false);
			setLogo(null);
		}
	}, [open]);

	const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files[0]) {
			const file = e.target.files[0];
			const reader = new FileReader();
			reader.onloadend = () => {
				setLogo(reader.result as string);
			};
			reader.readAsDataURL(file);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button size="sm" className="w-full gap-2" variant="default">
					<PlusIcon />
					<p>New Organization</p>
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px] w-11/12">
				<DialogHeader>
					<DialogTitle>New Organization</DialogTitle>
					<DialogDescription>
						Create a new organization to collaborate with your team.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<Label>Organization Name</Label>
						<Input
							placeholder="Name"
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>
					</div>
					<div className="flex flex-col gap-2">
						<Label>Organization Slug</Label>
						<Input
							value={slug}
							onChange={(e) => {
								setSlug(e.target.value);
								setIsSlugEdited(true);
							}}
							placeholder="Slug"
						/>
					</div>
					<div className="flex flex-col gap-2">
						<Label>Logo</Label>
						<Input type="file" accept="image/*" onChange={handleLogoChange} />
						{logo && (
							<div className="mt-2">
								<Image
									src={logo}
									alt="Logo preview"
									className="w-16 h-16 object-cover"
									width={16}
									height={16}
								/>
							</div>
						)}
					</div>
				</div>
				<DialogFooter>
					<Button
						disabled={loading}
						onClick={async () => {
							setLoading(true);
							await organization.create(
								{
									name: name,
									slug: slug,
									logo: logo || undefined,
								},
								{
									onResponse: () => {
										setLoading(false);
									},
									onSuccess: () => {
										toast.success("Organization created successfully");
										setOpen(false);
									},
									onError: (error) => {
										toast.error(error.error.message);
										setLoading(false);
									},
								},
							);
						}}
					>
						{loading ? (
							<Loader2 className="animate-spin" size={16} />
						) : (
							"Create"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function InviteMemberDialog({
	setOptimisticOrg,
	optimisticOrg,
}: {
	setOptimisticOrg: (org: ActiveOrganization | null) => void;
	optimisticOrg: ActiveOrganization | null;
}) {
	const [open, setOpen] = useState(false);
	const [email, setEmail] = useState("");
	const [role, setRole] = useState("member");
	const [teamId, setTeamId] = useState<string | undefined>(undefined);
	const [loading, setLoading] = useState(false);
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button size="sm" className="w-full gap-2" variant="secondary">
					<MailPlus size={16} />
					<p>Invite Member</p>
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px] w-11/12">
				<DialogHeader>
					<DialogTitle>Invite Member</DialogTitle>
					<DialogDescription>
						Invite a member to your organization.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-2">
					<Label>Email</Label>
					<Input
						placeholder="Email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
					/>
					<Label>Role</Label>
					<Select value={role} onValueChange={setRole}>
						<SelectTrigger>
							<SelectValue placeholder="Select a role" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="admin">Admin</SelectItem>
							<SelectItem value="member">Member</SelectItem>
						</SelectContent>
					</Select>
					{(optimisticOrg?.teams?.length ?? 0) > 0 && (
						<>
							<Label>Team (optional)</Label>
							<Select value={teamId} onValueChange={(v) => setTeamId(v)}>
								<SelectTrigger>
									<SelectValue placeholder="Select a team" />
								</SelectTrigger>
								<SelectContent>
									{optimisticOrg?.teams?.map((t) => (
										<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
									))}
								</SelectContent>
							</Select>
						</>
					)}
				</div>
				<DialogFooter>
					<DialogClose>
						<Button
							disabled={loading}
							onClick={async () => {
								const invite = organization.inviteMember({
									email: email,
									role: role as "member",
									teamId,
									fetchOptions: {
										throw: true,
										onSuccess: (ctx) => {
											if (optimisticOrg) {
												setOptimisticOrg({
													...optimisticOrg,
													invitations: [
														...(optimisticOrg?.invitations || []),
														ctx.data,
													],
												});
											}
										},
									}
                                });
								toast.promise(invite, {
									loading: "Inviting member...",
									success: "Member invited successfully",
									error: (error) => error.error.message,
								});
							}}
						>
							Invite
						</Button>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function CreateTeamDialog({
	canManage,
	onCreated,
}: {
	canManage: boolean | undefined;
	onCreated: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [loading, setLoading] = useState(false);
	if (!canManage) return null;
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button size="sm" className="w-full gap-2" variant="outline">
					<PlusIcon />
					<p>New Team</p>
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px] w-11/12">
				<DialogHeader>
					<DialogTitle>New Team</DialogTitle>
					<DialogDescription>Create a new team in this organization.</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-2">
					<Label>Team Name</Label>
					<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Team name" />
				</div>
				<DialogFooter>
					<Button
						disabled={loading || !name.trim()}
						onClick={async () => {
							setLoading(true);
							const p = organization.createTeam({ name });
							toast.promise(p, {
								loading: "Creating team...",
								success: "Team created",
								error: (e) => e.error?.message || "Failed to create team",
							});
							const { data } = await p;
							if (data) onCreated();
							setOpen(false);
							setName("");
							setLoading(false);
						}}
					>
						{loading ? <Loader2 className="animate-spin" size={16} /> : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function RenameTeamInline({
	teamId,
	name,
	onRenamed,
}: {
	teamId: string;
	name: string;
	onRenamed: (newName: string) => void;
}) {
	const [editing, setEditing] = useState(false);
	const [value, setValue] = useState(name);
	const [loading, setLoading] = useState(false);
	useEffect(() => setValue(name), [name]);
	return (
		<div className="flex items-center gap-1">
			{editing ? (
				<>
					<Input
						value={value}
						onChange={(e) => setValue(e.target.value)}
						className="h-8 w-32"
					/>
					<Button
						variant="ghost"
						size="icon"
						disabled={loading}
						onClick={async () => {
							setLoading(true);
							const p = organization.updateTeam({ teamId, data: { name: value } });
							toast.promise(p, {
								loading: "Renaming...",
								success: "Team renamed",
								error: (e) => e.error?.message || "Failed to rename",
							});
							await p;
							onRenamed(value);
							setEditing(false);
							setLoading(false);
						}}
					>
						<Check size={16} />
					</Button>
					<Button variant="ghost" size="icon" onClick={() => setEditing(false)}>
						<X size={16} />
					</Button>
				</>
			) : (
				<Button variant="outline" size="icon" onClick={() => setEditing(true)}>
					<Pencil size={16} />
				</Button>
			)}
		</div>
	);
}

function TeamMembersDialog({ teamId, teamName }: { teamId: string; teamName: string }) {
    const [open, setOpen] = useState(false);
    const [members, setMembers] = useState<Array<{ id: string; user: { id: string; name: string; image?: string | null } }>>([]);
    const [loading, setLoading] = useState(false);

    const loadMembers = async () => {
        setLoading(true);
        // Fetch team memberships
        const { data: tmData, error: tmError } = await organization.listTeamMembers({ query: { teamId } });
        if (tmError) {
            toast.error(tmError.message);
            setLoading(false);
            return;
        }
        // Fetch org members to resolve user details
        const { data: orgData } = await organization.listMembers({});
        const orgMembers = orgData?.members || [];
        const userMap: Record<string, { id: string; name: string; image?: string | null }> = {};
        for (const m of orgMembers) {
            userMap[m.user.id] = { id: m.user.id, name: m.user.name, image: m.user.image };
        }
        const enriched = (tmData || []).map((tm) => ({
            id: tm.id,
            user: userMap[tm.userId] || { id: tm.userId, name: "Unknown" },
        }));
        setMembers(enriched);
        setLoading(false);
    };

    useEffect(() => {
        if (open) {
            loadMembers();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, teamId]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline">Manage</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px] w-11/12">
                <DialogHeader>
                    <DialogTitle>Team Members - {teamName}</DialogTitle>
                    <DialogDescription>Manage members of this team.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3">
                    {loading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 size={16} className="animate-spin" /> Loading...
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {members.map((m) => (
                                <div key={m.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Avatar className="w-8 h-8">
                                            <AvatarImage src={m.user.image || undefined} />
                                            <AvatarFallback>{m.user.name?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <p className="text-sm">{m.user.name}</p>
                                    </div>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={async () => {
                                            const p = organization.removeTeamMember({ teamId, userId: m.user.id });
                                            toast.promise(p, {
                                                loading: "Removing member...",
                                                success: "Member removed",
                                                error: (e) => e.error?.message || "Failed to remove",
                                            });
                                            await p;
                                            setMembers((prev) => prev.filter((x) => x.id !== m.id));
                                        }}
                                    >
                                        Remove
                                    </Button>
                                </div>
                            ))}
                            {members.length === 0 && (
                                <p className="text-sm text-muted-foreground">No members in this team.</p>
                            )}
                        </div>
                    )}
                    <AddTeamMember teamId={teamId} onAdded={(m) => setMembers((prev) => [...prev, m])} />
                </div>
            </DialogContent>
        </Dialog>
    );
}

function AddTeamMember({ teamId, onAdded }: { teamId: string; onAdded: (m: { id: string; user: { id: string; name: string; image?: string | null } }) => void }) {
    const [open, setOpen] = useState(false);
    const [orgMembers, setOrgMembers] = useState<Array<{ id: string; user: { id: string; name: string; image?: string | null } }>>([]);
    const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Load organization members to choose from
        (async () => {
            const { data } = await organization.listMembers({});
            setOrgMembers(data?.members || []);
        })();
    }, []);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="secondary">Add Member</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] w-11/12">
                <DialogHeader>
                    <DialogTitle>Add to Team</DialogTitle>
                    <DialogDescription>Select an organization member to add to this team.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2">
                    <Label>Member</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a member" />
                        </SelectTrigger>
                        <SelectContent>
                            {orgMembers.map((m) => (
                                <SelectItem key={m.user.id} value={m.user.id}>{m.user.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button
                        disabled={!selectedUserId || loading}
                        onClick={async () => {
                            setLoading(true);
                            const p = organization.addTeamMember({ teamId, userId: selectedUserId! });
                            toast.promise(p, {
                                loading: "Adding member...",
                                success: "Member added",
                                error: (e) => e.error?.message || "Failed to add",
                            });
                            const { data } = await p;
                            if (data) {
                                const user = orgMembers.find((m) => m.user.id === selectedUserId)?.user;
                                if (user) {
                                    onAdded({ id: data.id, user });
                                } else {
                                    // Fallback: refetch team members dialog will reload next open
                                }
                            }
                            setOpen(false);
                            setSelectedUserId(undefined);
                            setLoading(false);
                        }}
                    >
                        {loading ? <Loader2 className="animate-spin" size={16} /> : "Add"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
